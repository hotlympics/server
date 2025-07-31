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
    uploadedImageIds: string[];
    poolImageIds: string[];
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
            uploadedImageIds: data.uploadedImageIds || [],
            poolImageIds: data.poolImageIds || [],
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
            uploadedImageIds: data.uploadedImageIds || [],
            poolImageIds: data.poolImageIds || [],
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
            uploadedImageIds: data.uploadedImageIds || [],
            poolImageIds: data.poolImageIds || [],
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

    static async addUploadedImageId(userId: string, imageId: string): Promise<void> {
        await this.collection.doc(userId).update({
            uploadedImageIds: FieldValue.arrayUnion(imageId),
        });
    }

    static async removeUploadedImageId(userId: string, imageId: string): Promise<void> {
        await this.collection.doc(userId).update({
            uploadedImageIds: FieldValue.arrayRemove(imageId),
        });
    }

    static async addPoolImageId(userId: string, imageId: string): Promise<void> {
        await this.collection.doc(userId).update({
            poolImageIds: FieldValue.arrayUnion(imageId),
        });
    }

    static async removePoolImageId(userId: string, imageId: string): Promise<void> {
        await this.collection.doc(userId).update({
            poolImageIds: FieldValue.arrayRemove(imageId),
        });
    }

    static async findOrCreateGoogleUser(googleData: { email: string; googleId: string }): Promise<User> {
        // Use a transaction to ensure atomicity
        const result = await firestore.runTransaction(async (transaction) => {
            // First, try to find by googleId
            const googleIdQuery = await transaction.get(
                this.collection.where('googleId', '==', googleData.googleId).limit(1)
            );

            if (!googleIdQuery.empty) {
                // User exists with this Google ID
                const doc = googleIdQuery.docs[0];
                const data = doc.data() as UserDocument;
                return {
                    id: doc.id,
                    email: data.email,
                    googleId: data.googleId,
                    password: data.password,
                    gender: data.gender,
                    dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toDate() : null,
                    rateCount: data.rateCount,
                    uploadedImageIds: data.uploadedImageIds || [],
                    poolImageIds: data.poolImageIds || [],
                };
            }

            // Next, try to find by email
            const emailQuery = await transaction.get(
                this.collection.where('email', '==', googleData.email).limit(1)
            );

            if (!emailQuery.empty) {
                // User exists with this email but not Google ID, update it
                const doc = emailQuery.docs[0];
                transaction.update(doc.ref, { googleId: googleData.googleId });

                const data = doc.data() as UserDocument;
                return {
                    id: doc.id,
                    email: data.email,
                    googleId: googleData.googleId, // Use the new Google ID
                    password: data.password,
                    gender: data.gender,
                    dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toDate() : null,
                    rateCount: data.rateCount,
                    uploadedImageIds: data.uploadedImageIds || [],
                    poolImageIds: data.poolImageIds || [],
                };
            }

            // No existing user found, create a new one
            const newUserData: UserDocument = {
                email: googleData.email,
                googleId: googleData.googleId,
                password: null,
                gender: 'unknown',
                dateOfBirth: null,
                rateCount: 0,
                uploadedImageIds: [],
                poolImageIds: [],
            };

            const newDocRef = this.collection.doc(); // Create a new document reference
            transaction.set(newDocRef, newUserData);

            return {
                id: newDocRef.id,
                ...newUserData,
                dateOfBirth: null,
            };
        });

        return result;
    }
}
