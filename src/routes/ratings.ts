import { Router, Response } from 'express';
import { type AuthRequest } from '../middleware/firebase-auth-middleware.js';
import { optionalAuthMiddleware } from '../middleware/optional-auth-middleware.js';
import { imageDataService } from '../services/image-data-service.js';
import { UserService } from '../services/user-service.js';

const router = Router();

const K_FACTOR = 32;

function calculateEloRating(
    winnerScore: number,
    loserScore: number,
): { newWinnerScore: number; newLoserScore: number } {
    const expectedWinner = 1 / (1 + Math.pow(10, (loserScore - winnerScore) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winnerScore - loserScore) / 400));

    const newWinnerScore = Math.round(winnerScore + K_FACTOR * (1 - expectedWinner));
    const newLoserScore = Math.round(loserScore + K_FACTOR * (0 - expectedLoser));

    return { newWinnerScore, newLoserScore };
}

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

            // Fetch both images
            const [winner, loser] = await Promise.all([
                imageDataService.getImageData(winnerId),
                imageDataService.getImageData(loserId),
            ]);

            if (!winner || !loser) {
                res.status(404).json({
                    error: {
                        message: 'One or both images not found',
                        status: 404,
                    },
                });
                return;
            }

            // Calculate new Elo scores
            const { newWinnerScore, newLoserScore } = calculateEloRating(
                winner.eloScore,
                loser.eloScore,
            );

            // Update both images in Firestore
            await Promise.all([
                imageDataService.updateRating(winnerId, {
                    battles: winner.battles + 1,
                    wins: winner.wins + 1,
                    eloScore: newWinnerScore,
                }),
                imageDataService.updateRating(loserId, {
                    battles: loser.battles + 1,
                    losses: loser.losses + 1,
                    eloScore: newLoserScore,
                }),
            ]);

            // Update user's rate count if authenticated
            if (req.user?.id) {
                await UserService.incrementRateCount(req.user.id);
            }

            res.json({
                success: true,
                message: 'Rating submitted successfully',
            });
        } catch (error) {
            console.error('Rating submission error:', error);
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
