import { firestore, COLLECTIONS } from '../config/firestore.js';
import { ImageData } from '../models/image-data.js';

const COLLECTION_NAME = COLLECTIONS.IMAGE_DATA;

export class ImageDataService {
    async createImageData(imageId: string, userId: string, imageUrl: string): Promise<ImageData> {
        const stats: ImageData = {
            imageId,
            userId,
            imageUrl,
            battles: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            eloScore: 1500,
            inPool: false,
        };

        await firestore.collection(COLLECTION_NAME).doc(imageId).set(stats);
        return stats;
    }

    async getImageData(imageId: string): Promise<ImageData | null> {
        const doc = await firestore.collection(COLLECTION_NAME).doc(imageId).get();
        return doc.exists ? (doc.data() as ImageData) : null;
    }

    async updatePoolStatus(imageId: string, inPool: boolean): Promise<void> {
        await firestore.collection(COLLECTION_NAME).doc(imageId).update({ inPool });
    }

    async batchUpdatePoolStatus(
        updates: Array<{ imageId: string; inPool: boolean }>,
    ): Promise<void> {
        const batch = firestore.batch();

        for (const { imageId, inPool } of updates) {
            const docRef = firestore.collection(COLLECTION_NAME).doc(imageId);
            batch.update(docRef, { inPool });
        }

        await batch.commit();
    }
}

export const imageDataService = new ImageDataService();
