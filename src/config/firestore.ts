import { Firestore } from '@google-cloud/firestore';

// Initialize Firestore with specific database
// In production (Cloud Run), this will use the default service account
// In development, you'll need to set FIREBASE_SERVICE_ACCOUNT
export const firestore = new Firestore({
    projectId: process.env.GCP_PROJECT_ID,
    databaseId: process.env.FIRESTORE_DATABASE_ID,
});

// Export db alias for compatibility
export const db = firestore;

// Collection names
export const COLLECTIONS = {
    USERS: 'users',
    IMAGE_DATA: 'image-data',
    BATTLES: 'battles',
    LEADERBOARDS: 'leaderboards',
    LEADERBOARDS_META: 'leaderboards_meta',
    REPORTS: 'reports',
} as const;
