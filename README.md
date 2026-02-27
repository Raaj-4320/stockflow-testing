<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/16134093-ab82-40de-a0c3-e8029db226bb

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Firebase Storage CORS setup (required for Netlify + local dev)

If product image uploads fail with browser CORS errors, configure your Firebase Storage bucket CORS policy.

⚠️ **Important:** Merging this PR does **not** fix browser CORS errors by itself. You must run `gsutil cors set cors.json gs://stockflow-d8de7.firebasestorage.app` in Google Cloud for the bucket configuration change to take effect.

Create `cors.json` with the exact content below:

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
