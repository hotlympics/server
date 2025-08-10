import { firestore, COLLECTIONS } from '../config/firestore.js';
import { ImageData, GlickoState } from '../models/image-data.js';
import { Timestamp } from '@google-cloud/firestore';
import { glicko2Service } from './glicko2-service.js';

const COLLECTION_NAME = COLLECTIONS.IMAGE_DATA;

export class ImageDataService {
    async createImageData(
        imageId: string,
        userId: string,
        imageUrl: string,
        gender: 'male' | 'female',
        dateOfBirth: Date,
        options?: { status?: 'pending' | 'active' },
    ): Promise<ImageData> {
        // Initialize Glicko-2 state for new images (0 battles = high RD)
        const glickoState = glicko2Service.initializeFromBattleCount(1500, 0);

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
            glicko: glickoState,
            inPool: false,
            status: options?.status || 'active',
        };

        // Convert Date to Firestore Timestamp for storage
        const documentData = {
            ...stats,
            dateOfBirth: Timestamp.fromDate(dateOfBirth),
            createdAt: Timestamp.now(),
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
            glicko: data.glicko as GlickoState,
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

    async getRandomImages(
        count: number,
        criteria: {
            gender?: 'male' | 'female';
        },
    ): Promise<ImageData[] | null> {
        // Build the query based on criteria
        let query: FirebaseFirestore.Query = firestore
            .collection(COLLECTION_NAME)
            .where('inPool', '==', true); // Only include images actively in the rating pool

        if (criteria.gender !== undefined) {
            query = query.where('gender', '==', criteria.gender);
        }

        const snapshot = await query.get();

        if (snapshot.empty || snapshot.size < count) {
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
                glicko: data.glicko as GlickoState,
                inPool: data.inPool as boolean,
                status: data.status as 'pending' | 'active' | undefined,
            };
        });

        // Group images by userId
        const imagesByUser = new Map<string, ImageData[]>();
        images.forEach((image: ImageData) => {
            const userImages = imagesByUser.get(image.userId) || [];
            userImages.push(image);
            imagesByUser.set(image.userId, userImages);
        });

        // Log the maximum possible count (number of unique users)
        const maxPossibleCount = imagesByUser.size;
        console.log(
            `[getRandomImages] Max possible count (unique users): ${maxPossibleCount}, Requested: ${count}, Criteria: ${JSON.stringify(criteria)}`,
        );

        // If we don't have enough different users with images which meet the criteria,
        // we can't fulfill the request
        if (imagesByUser.size < count) {
            return null;
        }

        const users = Array.from(imagesByUser.keys());
        const selectedImages: ImageData[] = [];
        const selectedUserIndices = new Set<number>();

        // Select images from different users
        while (selectedImages.length < count) {
            let userIndex = Math.floor(Math.random() * users.length);

            // Find a user we haven't selected yet
            while (selectedUserIndices.has(userIndex)) {
                userIndex = Math.floor(Math.random() * users.length);
            }

            selectedUserIndices.add(userIndex);
            const userId = users[userIndex];
            const userImages = imagesByUser.get(userId)!;

            // Randomly select one image from this user
            const image = userImages[Math.floor(Math.random() * userImages.length)];
            selectedImages.push(image);
        }

        return selectedImages;
    }

    async updateImageStatus(
        imageId: string,
        updates: { status: 'pending' | 'active'; fileName?: string; uploadedAt?: Date },
    ): Promise<void> {
        const updateData: Record<string, unknown> = { status: updates.status };
        if (updates.fileName) {
            updateData.imageUrl = updates.fileName;
        }
        if (updates.uploadedAt) {
            updateData.uploadedAt = Timestamp.fromDate(updates.uploadedAt);
        }
        await firestore.collection(COLLECTION_NAME).doc(imageId).update(updateData);
    }

    async getPendingUploads(olderThanMinutes: number): Promise<ImageData[]> {
        const cutoffTime = new Date();
        cutoffTime.setMinutes(cutoffTime.getMinutes() - olderThanMinutes);

        const snapshot = await firestore
            .collection(COLLECTION_NAME)
            .where('status', '==', 'pending')
            .where('createdAt', '<', Timestamp.fromDate(cutoffTime))
            .get();

        return snapshot.docs.map((doc) => {
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
                glicko: data.glicko as GlickoState, // All images now have glicko objects
                inPool: data.inPool as boolean,
                status: data.status as 'pending' | 'active',
            };
        });
    }
}

export const imageDataService = new ImageDataService();
