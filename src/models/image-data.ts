export interface ImageData {
    imageId: string;
    userId: string;
    imageUrl: string;
    gender: 'male' | 'female';
    dateOfBirth: Date;
    battles: number;
    wins: number;
    losses: number;
    draws?: number;
    eloScore: number;
    reactions?: Record<string, number>;
    inPool: boolean;
    status?: 'pending' | 'active';
}
