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
    eloScore: number; // Current Elo rating (default: 1500)
    inPool: boolean; // Whether the image is in the pool for battles
    status?: 'pending' | 'active'; // Upload status
}
