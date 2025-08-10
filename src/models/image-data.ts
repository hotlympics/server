import { Timestamp } from '@google-cloud/firestore';

export interface GlickoState {
    rating: number; // Display rating R
    rd: number; // Display rating deviation RD
    volatility: number; // σ (sigma)
    mu: number; // Internal rating μ
    phi: number; // Internal deviation ϕ
    lastUpdateAt: Timestamp; // For future inactivity logic
    systemVersion: 2;
}

export interface ImageData {
    imageId: string; // Unique ID that matches GCS filename
    userId: string; // Uploader's user ID
    imageUrl: string; // GCS filename (not full URL)
    gender: 'male' | 'female'; // Gender of the user who uploaded the image
    dateOfBirth: Date; // Date of birth of the user who uploaded the image
    battles: number; // Total number of battles
    wins: number; // Number of wins
    losses: number; // Number of losses
    draws: number; // Number of draws
    glicko: GlickoState; // Glicko-2 rating state
    inPool: boolean; // Whether the image is in the pool for battles
    status?: 'pending' | 'active'; // Upload status
}
