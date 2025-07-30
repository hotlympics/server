export interface User {
    id: string;
    email: string;
    googleId: string | null;
    password: string | null;
    gender: 'unknown' | 'male' | 'female';
    dateOfBirth: Date | null;
    rateCount: number;
}
