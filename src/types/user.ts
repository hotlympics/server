export interface User {
    id: string;
    firebaseUid: string;
    email: string;
    googleId: string | null;
    gender: 'unknown' | 'male' | 'female';
    dateOfBirth: Date | null;
    rateCount: number;
    uploadedImageIds: string[];
    poolImageIds: string[];
    displayName?: string | null;
    photoUrl?: string | null;
}
