# Firestore Security Hardening (Owner-Isolated App)

## What was vulnerable

1. **No repository Firestore rules file**
   - There was no `firestore.rules` (or `firebase.json` rule mapping), so rule posture was unknown from code review.
   - Risk: if deployed rules were permissive, any authenticated client SDK could bypass UI checks and directly read/write data.

2. **Client-side role assignment in auth bootstrap**
   - `services/auth.ts` wrote `role: 'admin'` from the client on registration/login bootstrap.
   - Risk: in weak rules, role or privilege-like fields can be abused through direct SDK writes.

3. **Write/read trust mostly enforced in frontend state guards**
   - Existing code had useful in-app checks (`assertCloudWriteReady`) but those are still client-enforced logic.
   - Risk: direct SDK callers can skip those guards if server-side rules are weak.

4. **Verified-email trust was app-flow based, not fully enforced at data boundary**
   - App login flow blocked unverified users, but data access hardening should also enforce verification at Firestore rules and key data paths.

---

## What was changed and why

### 1) Added strict Firestore rules file
- **File:** `firestore.rules`
- **Reason:** move trust boundary to server-side rules so direct SDK misuse from another client is denied.

Implemented:
- Deny-by-default fallback (`match /{document=**}` -> deny all).
- Owner-only access for `/stores/{uid}` and all nested subcollections using `request.auth.uid == uid`.
- Email verification required for store data access (`request.auth.token.email_verified == true`).
- `/users/{uid}` restricted to self-document only, with immutable identity fields on update and no deletes.

### 2) Added Firebase rules mapping config
- **File:** `firebase.json`
- **Reason:** explicit project config so `firebase deploy --only firestore:rules` uses repo-tracked rules.

### 3) Removed client-side role assignment
- **File:** `services/auth.ts`
- **Reason:** avoid client writing privilege-like field (`role`) from untrusted frontend.

Changes:
- Removed `role: 'admin'` from both registration and login bootstrap document writes.

### 4) Hardened cloud access preconditions in app code
- **File:** `services/storage.ts`
- **Reason:** defense-in-depth and clearer runtime failure behavior even before Firestore rejects writes.

Changes:
- `assertCloudWriteReady(...)` now blocks unverified users and audits blocked reason.
- `syncFromCloud(...)` now blocks unverified users for cloud access.
- `syncToCloud(...)` now blocks unverified users for cloud writes.

---

## Threat scenario addressed

If an attacker signs into Firebase Auth and attempts to use a custom script/client SDK directly (bypassing this app UI), server-side rules now enforce:
- user can only access their own `/stores/{uid}` namespace,
- unverified users cannot access store data,
- users cannot access other users' profile docs,
- unknown paths are denied.

This closes the “frontend-only guard reliance” gap.
