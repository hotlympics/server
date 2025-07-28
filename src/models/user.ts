export interface User {
    id: string;
    email: string;
    name?: string;
    password?: string; // hashed password for email auth
    googleId?: string; // for Google OAuth
    profilePicture?: string;
    provider: 'google' | 'email';
    createdAt: Date;
    hasUploadedPhoto: boolean;
    ratingCount: number;
}

// In-memory user store (replace with database in production)
export const users: Map<string, User> = new Map();
export const usersByEmail: Map<string, User> = new Map();
export const usersByGoogleId: Map<string, User> = new Map();

export const createUser = (userData: Omit<User, 'id' | 'createdAt' | 'hasUploadedPhoto' | 'ratingCount'>): User => {
    const user: User = {
        ...userData,
        id: Date.now().toString(),
        createdAt: new Date(),
        hasUploadedPhoto: false,
        ratingCount: 0,
    };

    users.set(user.id, user);
    usersByEmail.set(user.email, user);
    if (user.googleId) {
        usersByGoogleId.set(user.googleId, user);
    }

    return user;
};

export const findUserByEmail = (email: string): User | undefined => {
    return usersByEmail.get(email);
};

export const findUserByGoogleId = (googleId: string): User | undefined => {
    return usersByGoogleId.get(googleId);
};

export const findUserById = (id: string): User | undefined => {
    return users.get(id);
};
