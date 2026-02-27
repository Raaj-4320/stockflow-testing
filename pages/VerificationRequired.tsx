import React, { useState } from 'react';
import { MailCheck, Loader2, RefreshCw } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../components/ui';
import { auth } from '../services/firebase';
import { sendEmailVerification, signOut } from 'firebase/auth';

export default function VerificationRequired({ email }: { email?: string }) {
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState('Your email address is not verified. Please verify your email before logging in.');

  const handleResend = async () => {
    const user = auth?.currentUser;
    if (!user) {
      setMessage('Please log in again to resend a verification email.');
      return;
    }

    setIsSending(true);
    try {
      await sendEmailVerification(user);
      setMessage('If the email address is valid, a verification link has been sent.');
    } catch {
      setMessage('Unable to resend verification right now. Please try again shortly.');
    } finally {
      setIsSending(false);
    }
  };

  const handleBackToLogin = async () => {
    if (auth) {
      await signOut(auth);
    }
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center space-y-3">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <MailCheck className="w-8 h-8 text-primary" />
          </div>
          <CardTitle>Email Verification Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">{message}</p>
          {email && <p className="text-xs text-center text-muted-foreground">Signed in as: {email}</p>}
          <Button className="w-full" variant="outline" onClick={handleResend} disabled={isSending}>
            {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Resend Verification Email
          </Button>
          <Button className="w-full" onClick={handleBackToLogin}>Back to Login</Button>
        </CardContent>
      </Card>
    </div>
  );
}
