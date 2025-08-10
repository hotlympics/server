import { Router, Response } from 'express';
import { type AuthRequest } from '../middleware/firebase-auth-middleware.js';
import { optionalAuthMiddleware } from '../middleware/optional-auth-middleware.js';
import { imageDataService } from '../services/image-data-service.js';
import { UserService } from '../services/user-service.js';
import { battleHistoryService } from '../services/battle-history-service.js';
import { firestore, COLLECTIONS } from '../config/firestore.js';
import { glicko2Service } from '../services/glicko2-service.js';
import { Timestamp } from '@google-cloud/firestore';
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

            const winnerGlickoBefore = winner.glicko;
            const loserGlickoBefore = loser.glicko;

            // Calculate new Glicko ratings
            const { winner: updatedWinner, loser: updatedLoser } = glicko2Service.updateBattle(
                winnerGlickoBefore,
                loserGlickoBefore,
            );

            // Create new Glicko states with updated timestamp
            const winnerGlickoAfter = {
                rating: updatedWinner.rating,
                rd: updatedWinner.rd,
                volatility: updatedWinner.volatility,
                mu: updatedWinner.mu,
                phi: updatedWinner.phi,
                lastUpdateAt: Timestamp.now(),
                systemVersion: 2 as const,
            };

            const loserGlickoAfter = {
                rating: updatedLoser.rating,
                rd: updatedLoser.rd,
                volatility: updatedLoser.volatility,
                mu: updatedLoser.mu,
                phi: updatedLoser.phi,
                lastUpdateAt: Timestamp.now(),
                systemVersion: 2 as const,
            };

            // Create battle history document
            const battleHistoryData = {
                winnerImageId: winnerId,
                loserImageId: loserId,
                winnerUserId: winner.userId,
                loserUserId: loser.userId,
                winnerGlickoBefore,
                loserGlickoBefore,
                winnerGlickoAfter,
                loserGlickoAfter,
                ...(req.user?.id && { voterId: req.user.id }), // Only include voterId if user is logged in
            };
            const battleHistory =
                battleHistoryService.createBattleHistoryDocument(battleHistoryData);

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
                glicko: winnerGlickoAfter,
            });

            // Add loser image update to batch
            const loserRef = firestore.collection(COLLECTIONS.IMAGE_DATA).doc(loserId);
            batch.update(loserRef, {
                battles: loser.battles + 1,
                losses: loser.losses + 1,
                glicko: loserGlickoAfter,
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
