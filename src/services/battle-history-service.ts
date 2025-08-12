import { firestore, COLLECTIONS } from '../config/firestore.js';
import { BattleHistory } from '../models/battle-history.js';
import { GlickoState } from '../models/image-data.js';
import { Timestamp } from '@google-cloud/firestore';

const COLLECTION_NAME = COLLECTIONS.BATTLES;

export interface CreateBattleHistoryData {
    winnerImageId: string;
    loserImageId: string;
    winnerUserId: string;
    loserUserId: string;
    winnerGlickoBefore: GlickoState;
    loserGlickoBefore: GlickoState;
    winnerGlickoAfter: GlickoState;
    loserGlickoAfter: GlickoState;
    voterId?: string;
}

export const battleHistoryService = {
    generateBattleId(): string {
        return firestore.collection(COLLECTIONS.BATTLES).doc().id;
    },

    createBattleHistoryDocument(data: CreateBattleHistoryData): BattleHistory {
        return {
            battleId: this.generateBattleId(),
            participants: {
                winner: {
                    imageId: data.winnerImageId,
                    userId: data.winnerUserId,
                },
                loser: {
                    imageId: data.loserImageId,
                    userId: data.loserUserId,
                },
                imageIds: [data.winnerImageId, data.loserImageId],
                ...(data.voterId && { voterId: data.voterId }),
            },
            ratings: {
                before: {
                    winner: {
                        rating: data.winnerGlickoBefore.rating,
                        rd: data.winnerGlickoBefore.rd,
                    },
                    loser: {
                        rating: data.loserGlickoBefore.rating,
                        rd: data.loserGlickoBefore.rd,
                    },
                },
                after: {
                    winner: {
                        rating: data.winnerGlickoAfter.rating,
                        rd: data.winnerGlickoAfter.rd,
                    },
                    loser: {
                        rating: data.loserGlickoAfter.rating,
                        rd: data.loserGlickoAfter.rd,
                    },
                },
            },
            metadata: {
                timestamp: Timestamp.now(),
                systemVersion: 2,
            },
        };
    },

    async getBattleHistoryForUser(userId: string, limit: number = 50): Promise<BattleHistory[]> {
        const winnerQuery = firestore
            .collection(COLLECTION_NAME)
            .where('participants.winner.userId', '==', userId)
            .orderBy('metadata.timestamp', 'desc')
            .limit(limit);

        const loserQuery = firestore
            .collection(COLLECTION_NAME)
            .where('participants.loser.userId', '==', userId)
            .orderBy('metadata.timestamp', 'desc')
            .limit(limit);

        const [winnerSnapshot, loserSnapshot] = await Promise.all([
            winnerQuery.get(),
            loserQuery.get(),
        ]);

        const battles: BattleHistory[] = [];

        winnerSnapshot.forEach((doc) => {
            battles.push(doc.data() as BattleHistory);
        });

        loserSnapshot.forEach((doc) => {
            battles.push(doc.data() as BattleHistory);
        });

        // Sort by timestamp descending and limit results
        return battles
            .sort((a, b) => b.metadata.timestamp.toMillis() - a.metadata.timestamp.toMillis())
            .slice(0, limit);
    },

    async getBattleHistoryForImage(imageId: string, limit: number = 50): Promise<BattleHistory[]> {
        // Single, efficient query using the new array field
        const snap = await firestore
            .collection(COLLECTION_NAME)
            .where('participants.imageIds', 'array-contains', imageId)
            .orderBy('metadata.timestamp', 'desc')
            .limit(limit)
            .get();

        const battles: BattleHistory[] = [];
        snap.forEach((doc) => {
            battles.push(doc.data() as BattleHistory);
        });
        return battles;
    },
};
