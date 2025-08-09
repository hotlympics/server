import { Timestamp } from '@google-cloud/firestore';

export interface BattleHistory {
    battleId: string;
    winnerImageId: string;
    loserImageId: string;
    winnerUserId: string;
    loserUserId: string;

    // Glicko-2 before states (display values)
    winnerRatingBefore: number;
    winnerRdBefore: number;
    loserRatingBefore: number;
    loserRdBefore: number;

    // Glicko-2 after states (display values)
    winnerRatingAfter: number;
    winnerRdAfter: number;
    loserRatingAfter: number;
    loserRdAfter: number;

    // Metadata
    voterId?: string; // Optional authenticated voter
    timestamp: Timestamp;
    systemVersion: 2;
}
