import { Router, Response } from 'express';
import { type AuthRequest } from '../middleware/firebase-auth-middleware.js';
import { optionalAuthMiddleware } from '../middleware/optional-auth-middleware.js';
import { imageDataService } from '../services/image-data-service.js';

const router = Router();

// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post('/', optionalAuthMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        console.log('Reactions endpoint hit');
        const { imageId, reactionEmoji } = req.body as {
            imageId: string;
            reactionEmoji: string;
        };

        if (!imageId || !reactionEmoji) {
            res.status(400).json({
                error: {
                    message: 'Both imageId and reactionEmoji are required',
                    status: 400,
                },
            });
            return;
        }

        const image = await imageDataService.getImageData(imageId);
        if (!image) {
            res.status(404).json({
                error: {
                    message: 'Image not found',
                    status: 404,
                },
            });
            return;
        }

        const currentReactions: Record<string, number> = image.reactions ?? {};
        const updatedCount = (currentReactions[reactionEmoji] || 0) + 1;
        const updatedReactions = {
            ...currentReactions,
            [reactionEmoji]: updatedCount,
        };

        await imageDataService.updateReactions(imageId, updatedReactions);

        res.status(200).json({
            success: true,
            message: `Reaction '${reactionEmoji}' recorded`,
            updatedReactions,
        });
    } catch (error) {
        console.error('Reaction submission error:', error);
        res.status(500).json({
            error: {
                message: 'Failed to submit reaction',
                status: 500,
            },
        });
    }
});

export default router;
