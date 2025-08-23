import { Router, Response } from 'express';
import { type AuthRequest } from '../middleware/firebase-auth-middleware.js';
import { optionalAuthMiddleware } from '../middleware/optional-auth-middleware.js';
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

            // Use transaction to prevent race conditions when multiple users rate the same images
            await firestore.runTransaction(async (transaction) => {
                // Read current image data within the transaction
                const winnerRef = firestore.collection(COLLECTIONS.IMAGE_DATA).doc(winnerId);
                const loserRef = firestore.collection(COLLECTIONS.IMAGE_DATA).doc(loserId);

                const [winnerDoc, loserDoc] = await Promise.all([
                    transaction.get(winnerRef),
                    transaction.get(loserRef),
                ]);

                if (!winnerDoc.exists || !loserDoc.exists) {
                    throw new Error('One or both images not found');
                }

                const winner = winnerDoc.data() as {
                    userId: string;
                    battles: number;
                    wins: number;
                    losses: number;
                    glicko: {
                        rating: number;
                        rd: number;
                        volatility: number;
                        mu: number;
                        phi: number;
                        lastUpdateAt: Timestamp;
                        systemVersion: number;
                    };
                };
                const loser = loserDoc.data() as {
                    userId: string;
                    battles: number;
                    wins: number;
                    losses: number;
                    glicko: {
                        rating: number;
                        rd: number;
                        volatility: number;
                        mu: number;
                        phi: number;
                        lastUpdateAt: Timestamp;
                        systemVersion: number;
                    };
                };

                if (!winner || !loser) {
                    throw new Error('Invalid image data');
                }

                const winnerGlickoBefore = {
                    ...winner.glicko,
                    systemVersion: winner.glicko.systemVersion as 2,
                };
                const loserGlickoBefore = {
                    ...loser.glicko,
                    systemVersion: loser.glicko.systemVersion as 2,
                };

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

                // Write battle history
                const battleRef = firestore
                    .collection(COLLECTIONS.BATTLES)
                    .doc(battleHistory.battleId);
                transaction.set(battleRef, battleHistory);

                // Update winner image
                transaction.update(winnerRef, {
                    battles: winner.battles + 1,
                    wins: winner.wins + 1,
                    glicko: winnerGlickoAfter,
                });

                // Update loser image
                transaction.update(loserRef, {
                    battles: loser.battles + 1,
                    losses: loser.losses + 1,
                    glicko: loserGlickoAfter,
                });
            });

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
