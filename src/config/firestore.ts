import { Firestore } from '@google-cloud/firestore';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firestore
// In production on Cloud Run, this will use Application Default Credentials automatically
// For local development, you'll need to set GOOGLE_APPLICATION_CREDENTIALS env var
export const db = new Firestore({
    projectId: process.env.GCP_PROJECT_ID || 'hotlympics',
});

// Collection names
export const COLLECTIONS = {
    USERS: 'users',
    IMAGES: 'images',
    RATINGS: 'ratings',
} as const;

// Ensure indexes are created (Firestore will auto-create simple ones)
export const initializeFirestore = async () => {
    try {
        // Test connection
        const testDoc = await db.collection('_health').doc('test').get();
        console.log('Firestore connected successfully');
    } catch (error) {
        console.error('Firestore connection error:', error);
        // Don't throw - let the app start anyway
    }
};