import { firestore, COLLECTIONS } from '../config/firestore.js';
import { ImageData } from '../models/image-data.js';
import { Timestamp } from '@google-cloud/firestore';

const COLLECTION_NAME = COLLECTIONS.IMAGE_DATA;

export class ImageDataService {
    async createImageData(
        imageId: string,
        userId: string,
        imageUrl: string,
        gender: 'male' | 'female',
        dateOfBirth: Date,
    ): Promise<ImageData> {
        const stats: ImageData = {
            imageId,
            userId,
            imageUrl,
            gender,
            dateOfBirth,
            battles: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            eloScore: 1500,
            inPool: false,
        };

        // Convert Date to Firestore Timestamp for storage
        const documentData = {
            ...stats,
            dateOfBirth: Timestamp.fromDate(dateOfBirth),
        };

        await firestore.collection(COLLECTION_NAME).doc(imageId).set(documentData);
        return stats;
    }

    async getImageData(imageId: string): Promise<ImageData | null> {
        const doc = await firestore.collection(COLLECTION_NAME).doc(imageId).get();
        if (!doc.exists) {
            return null;
        }

        const data = doc.data();
        if (!data) {
            return null;
        }

        // Convert Firestore Timestamp to Date
        return {
            imageId: data.imageId as string,
            userId: data.userId as string,
            imageUrl: data.imageUrl as string,
            gender: data.gender as 'male' | 'female',
            dateOfBirth: (data.dateOfBirth as Timestamp).toDate(),
            battles: data.battles as number,
            wins: data.wins as number,
            losses: data.losses as number,
            draws: data.draws as number,
            eloScore: data.eloScore as number,
            inPool: data.inPool as boolean,
        };
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

    async getRandomImagePair(gender: 'male' | 'female'): Promise<ImageData[] | null> {
        // Query for images that are in the pool and match the gender
        const snapshot = await firestore
            .collection(COLLECTION_NAME)
            .where('inPool', '==', true)
            .where('gender', '==', gender)
            .get();

        if (snapshot.empty || snapshot.size < 2) {
            return null;
        }

        // Convert all documents to ImageData with proper date conversion
        const images = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                imageId: data.imageId as string,
                userId: data.userId as string,
                imageUrl: data.imageUrl as string,
                gender: data.gender as 'male' | 'female',
                dateOfBirth: (data.dateOfBirth as Timestamp).toDate(),
                battles: data.battles as number,
                wins: data.wins as number,
                losses: data.losses as number,
                draws: data.draws as number,
                eloScore: data.eloScore as number,
                inPool: data.inPool as boolean,
            };
        });

        // Group images by userId
        const imagesByUser = new Map<string, ImageData[]>();
        images.forEach((image) => {
            const userImages = imagesByUser.get(image.userId) || [];
            userImages.push(image);
            imagesByUser.set(image.userId, userImages);
        });

        // If we don't have at least 2 different users, we can't create a valid pair
        if (imagesByUser.size < 2) {
            return null;
        }

        // Convert to array of users for easier random selection
        const users = Array.from(imagesByUser.keys());

        // Randomly select two different users
        const firstUserIndex = Math.floor(Math.random() * users.length);
        let secondUserIndex = Math.floor(Math.random() * users.length);

        // Ensure we pick a different user
        while (secondUserIndex === firstUserIndex) {
            secondUserIndex = Math.floor(Math.random() * users.length);
        }

        const firstUserId = users[firstUserIndex];
        const secondUserId = users[secondUserIndex];

        // Get images from each user
        const firstUserImages = imagesByUser.get(firstUserId)!;
        const secondUserImages = imagesByUser.get(secondUserId)!;

        // Randomly select one image from each user
        const firstImage = firstUserImages[Math.floor(Math.random() * firstUserImages.length)];
        const secondImage = secondUserImages[Math.floor(Math.random() * secondUserImages.length)];

        return [firstImage, secondImage];
    }

    async updateRating(
        imageId: string,
        updates: { battles: number; wins?: number; losses?: number; eloScore: number },
    ): Promise<void> {
        await firestore.collection(COLLECTION_NAME).doc(imageId).update(updates);
    }
}

export const imageDataService = new ImageDataService();
