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
            randomSeed: Math.random(), // Add random seed for efficient random selection
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
            randomSeed: data.randomSeed as number,
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
        // Ensure count doesn't exceed Firestore's not-in limit
        if (count > 10) {
            throw new Error(
                `Cannot request more than 10 images at once (requested: ${count}). This is limited by Firestore's not-in constraint.`,
            );
        }

        const selectedImages: ImageData[] = [];
        const usedUserIds = new Set<string>();

        console.log(`[getRandomImages] Requesting ${count} images with criteria:`, criteria);

        while (selectedImages.length < count) {
            let image: ImageData | null = null;
            let attempts = 0;
            const maxAttempts = 10;

            // Try to find an image from an unused user
            while (!image && attempts < maxAttempts) {
                const randomValue = Math.random();

                // Build query with random threshold
                let query: FirebaseFirestore.Query = firestore
                    .collection(COLLECTION_NAME)
                    .where('inPool', '==', true)
                    .where('randomSeed', '>=', randomValue);

                if (criteria.gender !== undefined) {
                    query = query.where('gender', '==', criteria.gender);
                }

                // Exclude already used users (Firestore 'not-in' has max 10 items)
                if (usedUserIds.size > 0 && usedUserIds.size <= 10) {
                    query = query.where('userId', 'not-in', Array.from(usedUserIds));
                }

                const snapshot = await query.orderBy('randomSeed').limit(1).get();

                if (!snapshot.empty) {
                    const candidate = this.convertDocToImageData(snapshot.docs[0]);

                    // Double-check user uniqueness (in case we couldn't use not-in)
                    if (!usedUserIds.has(candidate.userId)) {
                        image = candidate;
                        usedUserIds.add(candidate.userId);
                    }
                }

                attempts++;
            }

            if (image) {
                selectedImages.push(image);
            } else {
                console.warn(
                    `[getRandomImages] Could not find unique image after ${maxAttempts} attempts. Found ${selectedImages.length}/${count} images.`,
                );
                break; // Couldn't find enough unique users
            }
        }

        if (selectedImages.length < count) {
            console.warn(
                `[getRandomImages] Only found ${selectedImages.length} images, requested ${count}. Not enough unique users with images matching criteria.`,
            );
            return null;
        }

        console.log(
            `[getRandomImages] Successfully selected ${selectedImages.length} images from unique users`,
        );
        return selectedImages;
    }

    private convertDocToImageData(doc: FirebaseFirestore.QueryDocumentSnapshot): ImageData {
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
            randomSeed: data.randomSeed as number,
        };
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
                randomSeed: data.randomSeed as number,
            };
        });
    }
}

export const imageDataService = new ImageDataService();
