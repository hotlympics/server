import { Router, Response } from 'express';
import { type AuthRequest } from '../middleware/firebase-auth-middleware.js';
import { optionalAuthMiddleware } from '../middleware/optional-auth-middleware.js';
import { userService } from '../services/user-service.js';
import { ratingService } from '../services/rating-service.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.post(
    '/',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    optionalAuthMiddleware,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { winnerId, loserId } = req.body as { winnerId: string; loserId: string };

            if (!winnerId || !loserId) {
                res.status(400).json({
                    error: {
                        message: 'Both winnerId and loserId are required',
                        status: 400,
                    },
                });
                return;
            }

            if (winnerId === loserId) {
                res.status(400).json({
                    error: {
                        message: 'Winner and loser cannot be the same',
                        status: 400,
                    },
                });
                return;
            }

            const result = await ratingService.submitRating({
                winnerId,
                loserId,
                voterId: req.user?.id,
            });

            if (!result.success) {
                res.status(500).json({
                    error: {
                        message: result.message,
                        status: 500,
                    },
                });
                return;
            }

            if (req.user?.id) {
                await userService.incrementRateCount(req.user.id);
            }

            res.json({
                success: true,
                message: result.message,
            });
        } catch (error) {
            logger.error('Rating submission error:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to submit rating',
                    status: 500,
                },
            });
        }
    },
);

export default router;
