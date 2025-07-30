import { firestore, COLLECTIONS } from '../config/firestore.js';
import type { User } from '../types/user.js';
import { Timestamp, FieldValue } from '@google-cloud/firestore';

// UserDocument is the same as User but with Firestore Timestamp instead of Date
interface UserDocument {
    email: string;
    googleId: string | null;
    password: string | null;
    gender: 'unknown' | 'male' | 'female';
    dateOfBirth: Timestamp | null;
    rateCount: number;
}

export class UserService {
    private static collection = firestore.collection(COLLECTIONS.USERS);

    static async createUser(userData: Omit<User, 'id'>): Promise<User> {
        const documentData: UserDocument = {
            ...userData,
            dateOfBirth: userData.dateOfBirth ? Timestamp.fromDate(userData.dateOfBirth) : null,
        };

        const docRef = await this.collection.add(documentData);

        const user: User = {
            id: docRef.id,
            ...userData,
        };

        return user;
    }

    static async getUserById(id: string): Promise<User | null> {
        const doc = await this.collection.doc(id).get();

        if (!doc.exists) {
            return null;
        }

        const data = doc.data() as UserDocument;
        return {
            id: doc.id,
            email: data.email,
            googleId: data.googleId,
            password: data.password,
            gender: data.gender,
            dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toDate() : null,
            rateCount: data.rateCount,
        };
    }

    static async getUserByEmail(email: string): Promise<User | null> {
        const snapshot = await this.collection.where('email', '==', email).limit(1).get();

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        const data = doc.data() as UserDocument;

        return {
            id: doc.id,
            email: data.email,
            googleId: data.googleId,
            password: data.password,
            gender: data.gender,
            dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toDate() : null,
            rateCount: data.rateCount,
        };
    }

    static async getUserByGoogleId(googleId: string): Promise<User | null> {
        const snapshot = await this.collection.where('googleId', '==', googleId).limit(1).get();

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        const data = doc.data() as UserDocument;

        return {
            id: doc.id,
            email: data.email,
            googleId: data.googleId,
            password: data.password,
            gender: data.gender,
            dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toDate() : null,
            rateCount: data.rateCount,
        };
    }

    static async updateUser(id: string, updates: Partial<Omit<User, 'id'>>): Promise<User | null> {
        const { dateOfBirth, ...otherUpdates } = updates;
        const updateData: Partial<UserDocument> = {
            ...otherUpdates,
        };

        if (dateOfBirth !== undefined) {
            updateData.dateOfBirth = dateOfBirth ? Timestamp.fromDate(dateOfBirth) : null;
        }

        await this.collection.doc(id).update(updateData);
        return this.getUserById(id);
    }

    static async incrementRateCount(id: string): Promise<void> {
        await this.collection.doc(id).update({
            rateCount: FieldValue.increment(1),
        });
    }
}
