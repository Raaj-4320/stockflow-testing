
import { auth, db } from './firebase';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendEmailVerification,
    sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const SESSION_KEY = 'stockflow_active_session';

export const getCurrentUser = (): string | null => {
  return localStorage.getItem(SESSION_KEY);
};

// Listen for Firebase Auth changes
if (auth) {
    onAuthStateChanged(auth, (user) => {
        if (user && user.emailVerified) {
            localStorage.setItem(SESSION_KEY, user.email || '');
        } else {
            localStorage.removeItem(SESSION_KEY);
        }
    });
}

export const login = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    if (!auth) return { success: false, message: "Firebase not configured." };
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!user.emailVerified) {
          await signOut(auth);
          localStorage.removeItem(SESSION_KEY);
          return { success: false, message: "Please verify your email before logging in." };
      }
      
      // Create Firestore user document on first login if it doesn't exist
      if (db) {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
              await setDoc(userDocRef, {
                  uid: user.uid,
                  email: user.email,
                  name: user.displayName || email.split('@')[0],
                  createdAt: new Date().toISOString(),
                  role: 'admin'
              });
          }
      }

      localStorage.setItem(SESSION_KEY, user.email || '');
      return { success: true };
    } catch (error: any) {
      console.error("Firebase Login Error:", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
          return { success: false, message: "Invalid email or password" };
      }
      return { success: false, message: error.message || "Authentication failed" };
    }
};

export const verifyEmailDomain = async (email: string): Promise<{ valid: boolean; message?: string }> => {
    const domain = email.split('@')[1];
    if (!domain) return { valid: false, message: "Invalid email format" };

    try {
        // Use Google's Public DNS API to check for MX (Mail Exchange) records
        // This verifies if the domain is actually configured to receive emails
        const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
        const data = await response.json();

        // If no MX records are found, check for A records as a fallback 
        // (some domains use A records for mail, though rare)
        if (!data.Answer || data.Answer.length === 0) {
            const aResponse = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
            const aData = await aResponse.json();
            
            if (!aData.Answer || aData.Answer.length === 0) {
                return { valid: false, message: "This email does not exist, please check for typos and try again." };
            }
        }
        
        return { valid: true };
    } catch (error) {
        console.error("Domain verification failed:", error);
        // If the check fails (e.g. network issue), we proceed to avoid blocking users
        return { valid: true };
    }
};

export const register = async (email: string, password: string, name: string): Promise<{ success: boolean; message?: string }> => {
    if (!auth) return { success: false, message: "Firebase not configured." };

    try {
      // Step 1: Verify domain authenticity before proceeding
      const domainCheck = await verifyEmailDomain(email);
      if (!domainCheck.valid) {
          return { success: false, message: domainCheck.message };
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Initialize user document in Firestore immediately
      if (db) {
          await setDoc(doc(db, "users", user.uid), {
              uid: user.uid,
              name: name,
              email: email,
              createdAt: new Date().toISOString(),
              role: 'admin'
          });
      }
      
      // Send email verification immediately
      try {
          await sendEmailVerification(user);
          console.log("Verification email sent to:", email);
      } catch (verifyError: any) {
          console.error("Error sending verification email during registration:", verifyError);
      }

      // Requirement: DO NOT auto-login after registration
      await signOut(auth);
      localStorage.removeItem(SESSION_KEY);

      return { success: true };
    } catch (error: any) {
      console.error("Firebase Register Error:", error);
      if (error.code === 'auth/email-already-in-use') {
          return { success: false, message: "Email already in use" };
      }
      return { success: false, message: error.message || "Registration failed" };
    }
};

export const resetPassword = async (email: string): Promise<{ success: boolean; message?: string }> => {
    if (!auth) return { success: false, message: "Firebase not configured." };
    
    try {
        // Step 1: Verify domain authenticity
        const domainCheck = await verifyEmailDomain(email);
        if (!domainCheck.valid) {
            return { success: false, message: domainCheck.message };
        }

        // Check if user exists in Firestore users collection
        if (db) {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("email", "==", email));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                return { success: false, message: "the user is not registered yet" };
            }
        }

        await sendPasswordResetEmail(auth, email);
        return { success: true, message: "password reset link has been sent on this mail" };
    } catch (error: any) {
        console.error("Firebase Reset Password Error:", error);
        if (error.code === 'auth/user-not-found') {
            return { success: false, message: "the user is not registered yet" };
        }
        return { success: false, message: "An error occurred while sending reset link." };
    }
};

export const resendVerificationEmail = async (email: string, password: string): Promise<{ success: boolean; message?: string }> => {
    if (!auth) return { success: false, message: "Firebase not configured." };
    
    try {
        // We need to sign in to get the user object to resend verification
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        if (user.emailVerified) {
            return { success: false, message: "Email is already verified." };
        }
        
        await sendEmailVerification(user);
        await signOut(auth);
        return { success: true, message: "Verification email resent successfully." };
    } catch (error: any) {
        console.error("Firebase Resend Verification Error:", error);
        return { success: false, message: error.message || "Failed to resend verification email." };
    }
};

export const logout = async () => {
  if (auth) {
    await signOut(auth);
  }
  localStorage.removeItem(SESSION_KEY);
  window.location.reload();
};


