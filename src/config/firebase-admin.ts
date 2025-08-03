import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK
// The app will use Application Default Credentials in production
// For local development, set GOOGLE_APPLICATION_CREDENTIALS env var
const initializeFirebaseAdmin = () => {
    if (getApps().length === 0) {
        const projectId = process.env.GCP_PROJECT_ID;
        console.log('Initializing Firebase Admin SDK with project ID:', projectId);

        if (!projectId) {
            console.error('WARNING: GCP_PROJECT_ID environment variable is not set');
        }

        const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (credentialsPath) {
            console.log('Using service account credentials from:', credentialsPath);
        } else {
            console.log(
                'No GOOGLE_APPLICATION_CREDENTIALS set, using Application Default Credentials',
            );
        }

        const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

        const app = initializeApp({
            projectId: projectId,
            storageBucket: storageBucket,
        });

        return app;
    }
    return getApp();
};

const firebaseApp = initializeFirebaseAdmin();

export const auth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// Re-export app for any other needs
export { firebaseApp };

// Create an admin-like object for backward compatibility
export const admin = {
    auth: () => auth,
    firestore: () => firestore,
    storage: () => storage,
};
