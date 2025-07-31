import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin SDK
// The app will use Application Default Credentials in production
// For local development, set GOOGLE_APPLICATION_CREDENTIALS env var
const initializeFirebaseAdmin = () => {
    if (admin.apps.length === 0) {
        admin.initializeApp({
            projectId: process.env.GCP_PROJECT_ID,
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
