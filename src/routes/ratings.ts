import { Router, Response } from 'express';
import { type AuthRequest } from '../middleware/firebase-auth-middleware.js';
import { optionalAuthMiddleware } from '../middleware/optional-auth-middleware.js';
import { imageDataService } from '../services/image-data-service.js';
import { UserService } from '../services/user-service.js';
import { battleHistoryService } from '../services/battle-history-service.js';
import { firestore, COLLECTIONS } from '../config/firestore.js';
import { Glicko2Service } from '../services/glicko2-service.js';
import { ImageData } from '../models/image-data.js';

const router = Router();

const K_FACTOR = 32;

/**
 * Ensures an ImageData object has Glicko fields, initializing them on-demand if missing
 */
export function ensureGlickoFields(imageData: ImageData): ImageData {
    if (!imageData.glicko) {
        // Initialize Glicko fields on-demand using existing battle count
        const glickoState = Glicko2Service.initializeFromBattleCount(
            imageData.eloScore || 1500,
            imageData.battles || 0,
        );
        return {
            ...imageData,
            glicko: glickoState,
        };
    }
    return imageData;
}

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

            // Create battle history document
            const battleHistory = battleHistoryService.createBattleHistoryDocument({
                winnerImageId: winnerId,
                loserImageId: loserId,
                winnerUserId: winner.userId,
                loserUserId: loser.userId,
                winnerEloChange: newWinnerScore - winner.eloScore,
                loserEloChange: newLoserScore - loser.eloScore,
                winnerEloBefore: winner.eloScore,
                loserEloBefore: loser.eloScore,
                winnerEloAfter: newWinnerScore,
                loserEloAfter: newLoserScore,
                voterId: req.user?.id,
                k_factor: K_FACTOR,
            });

            // Create batch write for atomic transaction
            const batch = firestore.batch();

            // Add battle history to batch
            const battleRef = firestore.collection(COLLECTIONS.BATTLES).doc(battleHistory.battleId);
            batch.set(battleRef, battleHistory);

            // Add winner image update to batch
            const winnerRef = firestore.collection(COLLECTIONS.IMAGE_DATA).doc(winnerId);
            batch.update(winnerRef, {
                battles: winner.battles + 1,
                wins: winner.wins + 1,
                eloScore: newWinnerScore,
            });

            // Add loser image update to batch
            const loserRef = firestore.collection(COLLECTIONS.IMAGE_DATA).doc(loserId);
            batch.update(loserRef, {
                battles: loser.battles + 1,
                losses: loser.losses + 1,
                eloScore: newLoserScore,
            });

            // Execute all updates atomically
            await batch.commit();

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
