import { firestore, COLLECTIONS } from '../config/firestore.js';
import { ImageData } from '../types/image-data.js';
import { Timestamp } from '@google-cloud/firestore';
import { glicko2Service } from './glicko2-service.js';
import { metadataService } from './metadata-service.js';

const COLLECTION_NAME = COLLECTIONS.IMAGE_DATA;

export const imageDataService = {
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

        // Update system metadata
        await metadataService.incrementTotalImages();

        return stats;
    },

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
    },

    /**
     * Transactionally update pool status for multiple images and user's poolImageIds array
     * Used by admin during user creation and user pool selection updates
     */
    async updateUserPoolStatus(
        userId: string,
        poolImageIds: string[],
        poolUpdates: Array<{ imageId: string; inPool: boolean }>,
    ): Promise<void> {
        await firestore.runTransaction(async (transaction) => {
            const userRef = firestore.collection(COLLECTIONS.USERS).doc(userId);

            // Update user's pool selections
            transaction.update(userRef, {
                poolImageIds: poolImageIds,
            });

            // Update each affected image's inPool status
            poolUpdates.forEach(({ imageId, inPool }) => {
                const imageRef = firestore.collection(COLLECTION_NAME).doc(imageId);
                transaction.update(imageRef, { inPool });
            });

            return Promise.resolve();
        });

        // Update metadata after transaction
        const toAdd = poolUpdates.filter((u) => u.inPool).length;
        const toRemove = poolUpdates.filter((u) => !u.inPool).length;

        if (toAdd > 0) {
            await metadataService.incrementPoolImages(toAdd);
        }
        if (toRemove > 0) {
            await metadataService.decrementPoolImages(toRemove);
        }
    },

    /**
     * Transactionally add images to user's pool during admin user creation
     * Updates both user document and all image documents atomically
     */
    async addImagesToUserPool(userId: string, imageIds: string[]): Promise<void> {
        await firestore.runTransaction(async (transaction) => {
            const userRef = firestore.collection(COLLECTIONS.USERS).doc(userId);

            // Update user document with pool image IDs
            transaction.update(userRef, {
                poolImageIds: imageIds,
            });

            // Update each image's inPool status
            imageIds.forEach((imageId) => {
                const imageRef = firestore.collection(COLLECTION_NAME).doc(imageId);
                transaction.update(imageRef, {
                    inPool: true,
                });
            });

            return Promise.resolve();
        });

        // Update metadata after transaction
        if (imageIds.length > 0) {
            await metadataService.incrementPoolImages(imageIds.length);
        }
    },

    /**
     * Transactionally toggle a single image's pool status
     * Updates both user's poolImageIds array and image's inPool field
     */
    async toggleImagePoolStatus(
        userId: string,
        imageId: string,
        addToPool: boolean,
        updatedPoolImageIds: string[],
    ): Promise<void> {
        await firestore.runTransaction(async (transaction) => {
            const userRef = firestore.collection(COLLECTIONS.USERS).doc(userId);
            const imageRef = firestore.collection(COLLECTION_NAME).doc(imageId);

            // Update user document with new pool image IDs
            transaction.update(userRef, {
                poolImageIds: updatedPoolImageIds,
            });

            // Update the inPool field in the image-data document
            transaction.update(imageRef, {
                inPool: addToPool,
            });

            return Promise.resolve();
        });

        // Update metadata after transaction
        if (addToPool) {
            await metadataService.incrementPoolImages();
        } else {
            await metadataService.decrementPoolImages();
        }
    },
};
