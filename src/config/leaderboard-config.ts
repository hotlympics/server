// Leaderboard configuration
// Contains the config-driven leaderboard criteria and settings

import { LeaderboardType } from '../models/leaderboard.js';

export interface LeaderboardConfig {
    key: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    criteria: Record<string, any>; // Dynamic criteria for Firestore queries
    type: LeaderboardType;
    limit: number;
}

export interface LeaderboardSystemConfig {
    version: number;
    regenerationIntervalMs: number;
    leaderboards: LeaderboardConfig[];
}

// Main configuration for the leaderboard system
export const LEADERBOARD_CONFIG: LeaderboardSystemConfig = {
    version: 1,
    regenerationIntervalMs: 10 * 60 * 1000, // 10 minutes
    leaderboards: [
        {
            key: 'female_top',
            criteria: { gender: 'female', inPool: true },
            type: 'top',
            limit: 5,
        },
        {
            key: 'female_bottom',
            criteria: { gender: 'female', inPool: true },
            type: 'bottom',
            limit: 5,
        },
        {
            key: 'male_top',
            criteria: { gender: 'male', inPool: true },
            type: 'top',
            limit: 5,
        },
        {
            key: 'male_bottom',
            criteria: { gender: 'male', inPool: true },
            type: 'bottom',
            limit: 5,
        },
    ],
};

// Leaderboard data schema version - increment when changing data structure
export const LEADERBOARD_DATA_VERSION = 1;

// Constants
export const LEADERBOARD_COLLECTIONS = {
    LEADERBOARDS: 'leaderboards',
    METADATA: 'leaderboards_meta',
} as const;

export const METADATA_DOCUMENT_ID = 'global';
