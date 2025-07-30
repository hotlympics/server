# Deployment Checklist for Hotlympics Server

## GitHub Secrets Required

Before deploying, ensure these secrets are set in your GitHub repository settings:

### Required Secrets:
- [ ] `GCP_PROJECT_ID` - Your Google Cloud project ID (e.g., "hotlympics")
- [ ] `GCP_REGION` - Deployment region (e.g., "us-central1")
- [ ] `GCP_REPOSITORY` - Artifact Registry repository name
- [ ] `GCP_SA_KEY` - Service account JSON key (with necessary permissions)
- [ ] `JWT_SECRET` - Secret key for JWT tokens (generate a secure random string)
- [ ] `GOOGLE_CLIENT_ID` - OAuth 2.0 client ID from Google Cloud Console
- [ ] `GOOGLE_CLIENT_SECRET` - OAuth 2.0 client secret
- [ ] `GOOGLE_REDIRECT_URI` - Production OAuth callback URL (e.g., "https://yourdomain.com/auth/google/callback")
- [ ] `FIRESTORE_DATABASE_ID` - Firestore database ID (set to "hotlympics")

## Google Cloud Setup

1. **Enable APIs**:
   ```bash
   gcloud services enable firestore.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable artifactregistry.googleapis.com
   ```

2. **Create Firestore Database**:
   ```bash
   gcloud firestore databases create --database=hotlympics --location=us-central1
   ```

3. **Create Artifact Registry Repository** (if not exists):
   ```bash
   gcloud artifacts repositories create [REPOSITORY_NAME] \
     --repository-format=docker \
     --location=[REGION]
   ```

4. **Service Account Permissions**:
   The service account needs these roles:
   - Cloud Run Admin
   - Artifact Registry Writer
   - Cloud Build Service Account
   - Firestore User

## Local Development

For local development, you need:

1. **Environment Variables** (.env file):
   ```
   PORT=3000
   NODE_ENV=development
   JWT_SECRET=your-dev-secret
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback
   GCP_PROJECT_ID=hotlympics
   FIRESTORE_DATABASE_ID=hotlympics
   ```

2. **Google Cloud Authentication**:
   ```bash
   gcloud auth application-default login
   ```

## Deployment Process

1. Push to main branch
2. GitHub Actions will automatically:
   - Build Docker image
   - Push to Artifact Registry
   - Deploy to Cloud Run
   - Output the service URL

## Post-Deployment

1. Update frontend environment with production API URL
2. Update Google OAuth redirect URI in Google Cloud Console
3. Deploy Firestore security rules:
   ```bash
   npm run deploy:rules
   ```