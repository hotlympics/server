import { Timestamp } from '@google-cloud/firestore';

export interface BattleHistory {
    battleId: string;

    participants: {
        winner: {
            imageId: string;
            userId: string;
        };
        loser: {
            imageId: string;
            userId: string;
        };
        // Keep array for efficient queries
        imageIds: [string, string]; // [winnerImageId, loserImageId]
        voterId?: string; // Optional authenticated voter
    };

    ratings: {
        before: {
            winner: {
                rating: number;
                rd: number;
            };
            loser: {
                rating: number;
                rd: number;
            };
        };
        after: {
            winner: {
                rating: number;
                rd: number;
            };
            loser: {
                rating: number;
                rd: number;
            };
        };
    };

    metadata: {
        timestamp: Timestamp;
        systemVersion: 2;
    };
}
