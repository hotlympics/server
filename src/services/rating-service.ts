import { firestore, COLLECTIONS } from '../config/firestore.js';
import { Timestamp } from '@google-cloud/firestore';
import { glicko2Service } from './glicko2-service.js';
import { battleHistoryService } from './battle-history-service.js';

export interface RatingSubmissionData {
    winnerId: string;
    loserId: string;
    voterId?: string; // Optional voter ID for logged-in users
}

export interface RatingSubmissionResult {
    success: boolean;
    message: string;
}

export const ratingService = {
    /**
     * Transactionally submit a rating between two images
     * Reads current image data, calculates new ratings, and updates all related documents atomically
     */
    async submitRating(data: RatingSubmissionData): Promise<RatingSubmissionResult> {
        try {
            await firestore.runTransaction(async (transaction) => {
                // Read current image data within the transaction
                const winnerRef = firestore.collection(COLLECTIONS.IMAGE_DATA).doc(data.winnerId);
                const loserRef = firestore.collection(COLLECTIONS.IMAGE_DATA).doc(data.loserId);

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
                    winnerImageId: data.winnerId,
                    loserImageId: data.loserId,
                    winnerUserId: winner.userId,
                    loserUserId: loser.userId,
                    winnerGlickoBefore,
                    loserGlickoBefore,
                    winnerGlickoAfter,
                    loserGlickoAfter,
                    ...(data.voterId && { voterId: data.voterId }),
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

            return {
                success: true,
                message: 'Rating submitted successfully',
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Failed to submit rating',
            };
        }
    },
};
