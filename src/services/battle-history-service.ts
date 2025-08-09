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

export class BattleHistoryService {
    generateBattleId(): string {
        return firestore.collection(COLLECTIONS.BATTLES).doc().id;
    }

    createBattleHistoryDocument(data: CreateBattleHistoryData): BattleHistory {
        return {
            battleId: this.generateBattleId(),
            winnerImageId: data.winnerImageId,
            loserImageId: data.loserImageId,
            winnerUserId: data.winnerUserId,
            loserUserId: data.loserUserId,

            // Before states
            winnerRatingBefore: data.winnerGlickoBefore.rating,
            winnerRdBefore: data.winnerGlickoBefore.rd,
            loserRatingBefore: data.loserGlickoBefore.rating,
            loserRdBefore: data.loserGlickoBefore.rd,

            // After states
            winnerRatingAfter: data.winnerGlickoAfter.rating,
            winnerRdAfter: data.winnerGlickoAfter.rd,
            loserRatingAfter: data.loserGlickoAfter.rating,
            loserRdAfter: data.loserGlickoAfter.rd,

            // Metadata
            timestamp: Timestamp.now(),
            systemVersion: 2,
            ...(data.voterId && { voterId: data.voterId }), // Only include voterId if present
        };
    }

    async getBattleHistoryForUser(userId: string, limit: number = 50): Promise<BattleHistory[]> {
        const winnerQuery = firestore
            .collection(COLLECTION_NAME)
            .where('winnerUserId', '==', userId)
            .where('systemVersion', '==', 2)
            .orderBy('timestamp', 'desc')
            .limit(limit);

        const loserQuery = firestore
            .collection(COLLECTION_NAME)
            .where('loserUserId', '==', userId)
            .where('systemVersion', '==', 2)
            .orderBy('timestamp', 'desc')
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
            .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
            .slice(0, limit);
    }

    async getBattleHistoryForImage(imageId: string, limit: number = 50): Promise<BattleHistory[]> {
        const winnerQuery = firestore
            .collection(COLLECTION_NAME)
            .where('winnerImageId', '==', imageId)
            .where('systemVersion', '==', 2)
            .orderBy('timestamp', 'desc')
            .limit(limit);

        const loserQuery = firestore
            .collection(COLLECTION_NAME)
            .where('loserImageId', '==', imageId)
            .where('systemVersion', '==', 2)
            .orderBy('timestamp', 'desc')
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
            .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())
            .slice(0, limit);
    }
}

export const battleHistoryService = new BattleHistoryService();
