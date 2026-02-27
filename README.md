
## Firebase Storage CORS setup (required for Netlify + local dev)

If product image uploads fail with browser CORS errors, configure your Firebase Storage bucket CORS policy.

⚠️ **Important:** Merging this PR does **not** fix browser CORS errors by itself. You must run `gsutil cors set cors.json gs://stockflow-d8de7.firebasestorage.app` in Google Cloud for the bucket configuration change to take effect.

Create `cors.json` with the exact content below:
Create `cors.json`:

```json
[
  {
    "origin": [
      "https://testing-stockflow.netlify.app",
      "https://deploy-preview-3--testing-stockflow.netlify.app",
      "http://localhost:5173"
    ],
    "method": ["GET", "POST", "PUT"],
    "responseHeader": ["Content-Type", "Authorization"],
      "http://localhost:5173"
    ],
    "method": ["GET", "POST", "PUT"],
    "responseHeader": [
      "Content-Type",
      "Authorization",
      "x-goog-resumable",
      "x-goog-meta-*"
    ],
    "maxAgeSeconds": 3600
  }
]
```

Copy/paste-ready commands:

```bash
# 1) Authenticate Google Cloud CLI
gcloud auth login

# 2) Set the project
gcloud config set project stockflow-d8de7

# 3) Apply CORS to Firebase Storage bucket
gsutil cors set cors.json gs://stockflow-d8de7.firebasestorage.app

# 4) Verify CORS configuration
gsutil cors get gs://stockflow-d8de7.firebasestorage.app
```

## One-time migration: Firebase Storage image URLs to Cloudinary

This migration is **backend-only** and does not modify auth, transactions, or product IDs.

### Required environment variables

Add these to your `.env` (or exported shell env) before running:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

> For `FIREBASE_PRIVATE_KEY`, keep newline escapes (`\n`) if storing in `.env`.

### What the script does

- Scans `products` collection docs and also `stores/{storeId}.products[]` entries.
- Migrates only Firebase-hosted image URLs to Cloudinary.
- Skips already-Cloudinary URLs.
- Updates only image field (`imageUrl` if present, otherwise `image`) plus migration metadata:
  - `migratedAt`
  - `imageProvider: "cloudinary"`
- Never deletes Firebase images.
- Continues on failures and prints final report.

### Run migration

Dry run (no upload, no Firestore writes):

```bash
npm run migrate-images -- --dry-run
```

Live migration:

```bash
npm run migrate-images
Apply it (replace bucket name):

```bash
gsutil cors set cors.json gs://YOUR_FIREBASE_STORAGE_BUCKET
```

Verify:

```bash
gsutil cors get gs://YOUR_FIREBASE_STORAGE_BUCKET
```
