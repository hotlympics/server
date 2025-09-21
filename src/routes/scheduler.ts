// Scheduler API endpoints for Google Cloud Scheduler tasks
// Requires scheduler authentication via API key

import { Router, Response } from 'express';
import { firestore, COLLECTIONS } from '../config/firestore.js';
import { logger } from '../utils/logger.js';
import {
    schedulerAuthMiddleware,
    type SchedulerRequest,
} from '../middleware/scheduler-auth-middleware.js';

const router = Router();

/**
 * POST /scheduler/reassign-random-seeds
 * Reassigns random seed values to all images in the image-data collection
 * This endpoint is called by Google Cloud Scheduler to periodically shuffle image selection
 */
router.post(
    '/reassign-random-seeds',
    schedulerAuthMiddleware,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (_req: SchedulerRequest, res: Response): Promise<void> => {
        try {
            logger.info('Starting random seed reassignment for all images');

            const batchSize = 500; // Firestore batch write limit
            const imageDataRef = firestore.collection(COLLECTIONS.IMAGE_DATA);

            // Get all documents
            const snapshot = await imageDataRef.get();
            const totalImages = snapshot.size;

            logger.info(`Found ${totalImages} images to update`);

            if (totalImages === 0) {
                res.json({
                    success: true,
                    message: 'No images found to update',
                    totalImages: 0,
                    timestamp: new Date().toISOString(),
                });
                return;
            }

            // Process in batches
            let processedCount = 0;
            const batches: FirebaseFirestore.WriteBatch[] = [];
            let currentBatch = firestore.batch();
            let currentBatchSize = 0;

            snapshot.forEach((doc) => {
                // Add update to current batch
                currentBatch.update(doc.ref, {
                    randomSeed: Math.random(),
                });
                currentBatchSize++;
                processedCount++;

                // If batch is full, start a new one
                if (currentBatchSize >= batchSize) {
                    batches.push(currentBatch);
                    currentBatch = firestore.batch();
                    currentBatchSize = 0;
                }
            });

            // Add the last batch if it has any operations
            if (currentBatchSize > 0) {
                batches.push(currentBatch);
            }

            // Commit all batches
            logger.info(`Committing ${batches.length} batches`);
            await Promise.all(batches.map((batch) => batch.commit()));

            logger.info(`Successfully updated random seeds for ${processedCount} images`);

            res.json({
                success: true,
                message: 'Random seeds reassigned successfully',
                totalImages: processedCount,
                batches: batches.length,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            logger.error('Error during random seed reassignment:', error);
            res.status(500).json({
                error: 'Failed to reassign random seeds',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    },
);

export default router;
