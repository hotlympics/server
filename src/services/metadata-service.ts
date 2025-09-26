import { firestore } from '../config/firebase-admin.js';
import { FieldValue } from '@google-cloud/firestore';
import { logger } from '../utils/logger.js';

const METADATA_COLLECTION = 'metadata';
const METADATA_DOCUMENT = 'metadata';

export interface SystemMetadata {
    totalImages: number;
    imagesInPool: number;
    lastUpdated: string;
}

class MetadataService {
    async getSystemMetadata(): Promise<SystemMetadata> {
        try {
            const doc = await firestore
                .collection(METADATA_COLLECTION)
                .doc(METADATA_DOCUMENT)
                .get();

            if (!doc.exists) {
                // Initialize if doesn't exist
                const initialMetadata: SystemMetadata = {
                    totalImages: 0,
                    imagesInPool: 0,
                    lastUpdated: new Date().toISOString(),
                };
                await firestore
                    .collection(METADATA_COLLECTION)
                    .doc(METADATA_DOCUMENT)
                    .set(initialMetadata);
                logger.info('Initialized system metadata document');
                return initialMetadata;
            }

            return doc.data() as SystemMetadata;
        } catch (error) {
            logger.error('Error fetching system metadata:', error);
            throw error;
        }
    }

    async incrementTotalImages(count: number = 1): Promise<void> {
        try {
            await firestore
                .collection(METADATA_COLLECTION)
                .doc(METADATA_DOCUMENT)
                .set(
                    {
                        totalImages: FieldValue.increment(count),
                        lastUpdated: new Date().toISOString(),
                    },
                    { merge: true },
                );
        } catch (error) {
            logger.error('Error incrementing total images:', error);
            throw error;
        }
    }

    async decrementTotalImages(count: number = 1): Promise<void> {
        try {
            await firestore
                .collection(METADATA_COLLECTION)
                .doc(METADATA_DOCUMENT)
                .set(
                    {
                        totalImages: FieldValue.increment(-count),
                        lastUpdated: new Date().toISOString(),
                    },
                    { merge: true },
                );
        } catch (error) {
            logger.error('Error decrementing total images:', error);
            throw error;
        }
    }

    async incrementPoolImages(count: number = 1): Promise<void> {
        try {
            await firestore
                .collection(METADATA_COLLECTION)
                .doc(METADATA_DOCUMENT)
                .set(
                    {
                        imagesInPool: FieldValue.increment(count),
                        lastUpdated: new Date().toISOString(),
                    },
                    { merge: true },
                );
        } catch (error) {
            logger.error('Error incrementing pool images:', error);
            throw error;
        }
    }

    async decrementPoolImages(count: number = 1): Promise<void> {
        try {
            await firestore
                .collection(METADATA_COLLECTION)
                .doc(METADATA_DOCUMENT)
                .set(
                    {
                        imagesInPool: FieldValue.increment(-count),
                        lastUpdated: new Date().toISOString(),
                    },
                    { merge: true },
                );
        } catch (error) {
            logger.error('Error decrementing pool images:', error);
            throw error;
        }
    }
}

export const metadataService = new MetadataService();
