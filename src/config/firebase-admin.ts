import { initializeApp, getApps, getApp, type AppOptions } from 'firebase-admin/app';
import { cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK
// The app will use Application Default Credentials in production
// For local development, set FIREBASE_SERVICE_ACCOUNT env var
const initializeFirebaseAdmin = () => {
    if (getApps().length === 0) {
        const projectId = process.env.GCP_PROJECT_ID;
        console.log('Initializing Firebase Admin SDK with project ID:', projectId);

        if (!projectId) {
            console.error('WARNING: GCP_PROJECT_ID environment variable is not set');
        }

        const credentialsPath = process.env.FIREBASE_SERVICE_ACCOUNT;
        const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

        const appConfig: AppOptions = {
            projectId: projectId,
            storageBucket: storageBucket,
        };

        if (credentialsPath) {
            console.log('Using service account credentials from:', credentialsPath);
            appConfig.credential = cert(credentialsPath);
        } else {
            console.log('No FIREBASE_SERVICE_ACCOUNT set, using Application Default Credentials');
            // Set quota project for Application Default Credentials
            if (projectId && !process.env.GOOGLE_CLOUD_QUOTA_PROJECT) {
                process.env.GOOGLE_CLOUD_QUOTA_PROJECT = projectId;
            }
        }

        const app = initializeApp(appConfig);

        return app;
    }
    return getApp();
};

const firebaseApp = initializeFirebaseAdmin();

export const auth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp, 'hotlympics'); // Use the hotlympics database specifically
export const storage = getStorage(firebaseApp);

// Re-export app for any other needs
export { firebaseApp };

// Create an admin-like object for backward compatibility
export const admin = {
    auth: () => auth,
    firestore: () => firestore,
    storage: () => storage,
};
