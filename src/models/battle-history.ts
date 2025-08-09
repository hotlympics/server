import { Timestamp } from '@google-cloud/firestore';

// New Glicko-2 optimized battle history interface
export interface BattleHistory {
    battleId: string;
    winnerImageId: string;
    loserImageId: string;
    winnerUserId: string; // For user stats/history queries
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

    // Changes (helpful for stats/analysis)
    winnerRatingChange: number; // after - before
    winnerRdChange: number; // after - before (usually negative)
    loserRatingChange: number; // after - before (usually negative)
    loserRdChange: number; // after - before (usually negative)

    // Metadata
    voterId?: string; // Optional authenticated voter
    timestamp: Timestamp;
    tau: number; // Glicko-2 tau constant used
    systemVersion: 2;
}
