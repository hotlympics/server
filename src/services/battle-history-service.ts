import { firestore, COLLECTIONS } from '../config/firestore.js';
import { BattleHistory } from '../models/battle-history.js';
import { Timestamp } from '@google-cloud/firestore';

const COLLECTION_NAME = COLLECTIONS.BATTLES;

export interface CreateBattleHistoryData {
    winnerImageId: string;
    loserImageId: string;
    winnerUserId: string;
    loserUserId: string;
    winnerEloChange: number;
    loserEloChange: number;
    winnerEloBefore: number;
    loserEloBefore: number;
    winnerEloAfter: number;
    loserEloAfter: number;
    voterId?: string;
    k_factor: number;
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
            winnerEloChange: data.winnerEloChange,
            loserEloChange: data.loserEloChange,
            winnerEloBefore: data.winnerEloBefore,
            loserEloBefore: data.loserEloBefore,
            winnerEloAfter: data.winnerEloAfter,
            loserEloAfter: data.loserEloAfter,
            timestamp: Timestamp.now(),
            voterId: data.voterId,
            k_factor: data.k_factor,
        };
    }

    async getBattleHistoryForUser(userId: string, limit: number = 50): Promise<BattleHistory[]> {
        const winnerQuery = firestore
            .collection(COLLECTION_NAME)
            .where('winnerUserId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(limit);

        const loserQuery = firestore
            .collection(COLLECTION_NAME)
            .where('loserUserId', '==', userId)
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
            .orderBy('timestamp', 'desc')
            .limit(limit);

        const loserQuery = firestore
            .collection(COLLECTION_NAME)
            .where('loserImageId', '==', imageId)
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
