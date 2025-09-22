import { Router } from 'express';
import { optionalAuthMiddleware } from '../middleware/optional-auth-middleware.js';
import type { AuthRequest } from '../middleware/firebase-auth-middleware.js';
import { logger } from '../utils/logger.js';
import { reportService } from '../services/report-service.js';
import type { ReportCategory } from '../types/report.js';

const router = Router();

/**
 * Submit a report for an image
 */
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post('/', optionalAuthMiddleware, async (req: AuthRequest, res, next) => {
    try {
        const { imageId, category, description } = req.body as {
            imageId: string;
            category: ReportCategory;
            description?: string;
        };

        // For authenticated users, use their user ID
        // For anonymous users, use 'anonymous' as the user ID
        const userId: string = req.user?.id || 'anonymous';

        // Validate required fields
        if (!imageId || !category) {
            return res.status(400).json({
                error: 'imageId and category are required',
            });
        }

        // Validate category
        const validCategories: ReportCategory[] = [
            'NOT_PERSON',
            'IMPERSONATION',
            'NUDITY',
            'VIOLENCE',
            'SPAM',
            'INAPPROPRIATE',
            'OTHER',
        ];

        if (!validCategories.includes(category)) {
            return res.status(400).json({
                error: 'Invalid report category',
            });
        }

        const reportId = await reportService.submitReport(imageId, userId, category, description);

        logger.info(`Report submitted successfully`, {
            reportId,
            imageId,
            userId,
            category,
            isAnonymous: !req.user,
        });

        return res.status(201).json({
            success: true,
            reportId,
            message: 'Report submitted successfully',
        });
    } catch (error) {
        logger.error('Error submitting report:', error);

        // Handle specific error cases
        if (error instanceof Error) {
            if (error.message === 'Image not found') {
                return res.status(404).json({ error: error.message });
            }
            if (error.message === 'You have already reported this image') {
                return res.status(409).json({ error: error.message });
            }
            if (error.message === 'Description is required for OTHER category reports') {
                return res.status(400).json({ error: error.message });
            }
        }

        return next(error);
    }
});

export default router;
