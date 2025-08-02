import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK
// The app will use Application Default Credentials in production
// For local development, set GOOGLE_APPLICATION_CREDENTIALS env var
const initializeFirebaseAdmin = () => {
    if (admin.apps.length === 0) {
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

        admin.initializeApp({
            projectId: projectId,
            storageBucket: storageBucket,
        });
    }
    return admin;
};

const firebaseAdmin = initializeFirebaseAdmin();

export const auth = firebaseAdmin.auth();
export const firestore = firebaseAdmin.firestore();

// Re-export admin for any other needs
export { firebaseAdmin };
export { firebaseAdmin as admin };
