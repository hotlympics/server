// Leaderboard types and interfaces
// This file contains all TypeScript interfaces and types for the leaderboard system

export interface LeaderboardEntry {
    imageId: string;
    imageUrl: string;
    userId: string;
    rating: number;
    gender: string;
    battles: number;
    wins: number;
    losses: number;
    draws: number;
    dateOfBirth: string;
}

export interface LeaderboardMetadata {
    generatedAt: string;
    updateCount: number;
    firstGeneratedAt: string;
    actualEntryCount: number;
    averageRating: number;
    ratingRange: {
        highest: number;
        lowest: number;
    };
    dataQuality: {
        allImagesValid: boolean;
        missingFields: string[];
        errorCount: number;
    };
    configVersion: number;
    configKey: string;
}

export interface LeaderboardDocument {
    entries: LeaderboardEntry[];
    metadata: LeaderboardMetadata;
}

export interface GlobalMetadata {
    lastGeneratedAt: string;
    updateCount: number;
    configVersion: number;
    leaderboardVersion: number;
    leaderboardCount: number;
    generatorInfo: {
        lastRunStatus: 'success' | 'error';
        leaderboardsProcessed: number;
        error?: string;
    };
}

export type LeaderboardType = 'top' | 'bottom';
export type Gender = 'male' | 'female';
