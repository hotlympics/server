import { Timestamp } from '@google-cloud/firestore';

export interface BattleHistory {
    battleId: string;
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

    timestamp: Timestamp;
    voterId?: string;
    k_factor: number;
}
