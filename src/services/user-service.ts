import { firestore, COLLECTIONS } from '../config/firestore.js';
import type { User } from '../types/user.js';
import { Timestamp, FieldValue } from '@google-cloud/firestore';

// UserDocument is the same as User but with Firestore Timestamp instead of Date
interface UserDocument {
    firebaseUid: string;
    email: string;
    googleId: string | null;
    gender: 'unknown' | 'male' | 'female';
    dateOfBirth: Timestamp | null;
    tosVersion: string | null;
    tosAcceptedAt: Timestamp | null;
    rateCount: number;
    uploadedImageIds: string[];
    poolImageIds: string[];
    displayName?: string | null;
    photoUrl?: string | null;
}

export class UserService {
    private static collection = firestore.collection(COLLECTIONS.USERS);

    private static documentToUser(doc: FirebaseFirestore.DocumentSnapshot): User | null {
        if (!doc.exists) {
            return null;
        }

        const data = doc.data() as UserDocument;
        return {
            id: doc.id,
            firebaseUid: data.firebaseUid,
            email: data.email,
            googleId: data.googleId,
            gender: data.gender,
            dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toDate() : null,
            tosVersion: data.tosVersion || null,
            tosAcceptedAt: data.tosAcceptedAt ? data.tosAcceptedAt.toDate() : null,
            rateCount: data.rateCount,
            uploadedImageIds: data.uploadedImageIds || [],
            poolImageIds: data.poolImageIds || [],
            displayName: data.displayName,
            photoUrl: data.photoUrl,
        };
    }

    static async createUser(userData: Omit<User, 'id'>): Promise<User> {
        const documentData: UserDocument = {
            ...userData,
            dateOfBirth: userData.dateOfBirth ? Timestamp.fromDate(userData.dateOfBirth) : null,
            tosAcceptedAt: userData.tosAcceptedAt
                ? Timestamp.fromDate(userData.tosAcceptedAt)
                : null,
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

        return this.documentToUser(doc);
    }

    static async getUserByEmail(email: string): Promise<User | null> {
        const snapshot = await this.collection.where('email', '==', email).limit(1).get();

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        return this.documentToUser(doc);
    }

    static async getUserByGoogleId(googleId: string): Promise<User | null> {
        const snapshot = await this.collection.where('googleId', '==', googleId).limit(1).get();

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        return this.documentToUser(doc);
    }

    static async updateUser(id: string, updates: Partial<Omit<User, 'id'>>): Promise<User | null> {
        const { dateOfBirth, tosAcceptedAt, ...otherUpdates } = updates;
        const updateData: Partial<UserDocument> = {
            ...otherUpdates,
        };

        if (dateOfBirth !== undefined) {
            updateData.dateOfBirth = dateOfBirth ? Timestamp.fromDate(dateOfBirth) : null;
        }

        if (tosAcceptedAt !== undefined) {
            updateData.tosAcceptedAt = tosAcceptedAt ? Timestamp.fromDate(tosAcceptedAt) : null;
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

    static async findOrCreateGoogleUser(googleData: {
        email: string;
        googleId: string;
    }): Promise<User> {
        // Use a transaction to ensure atomicity
        const result = await firestore.runTransaction(async (transaction) => {
            // First, try to find by googleId
            const googleIdQuery = await transaction.get(
                this.collection.where('googleId', '==', googleData.googleId).limit(1),
            );

            if (!googleIdQuery.empty) {
                // User exists with this Google ID
                const doc = googleIdQuery.docs[0];
                const data = doc.data() as UserDocument;
                return {
                    id: doc.id,
                    firebaseUid: data.firebaseUid,
                    email: data.email,
                    googleId: data.googleId,
                    gender: data.gender,
                    dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toDate() : null,
                    tosVersion: data.tosVersion || null,
                    tosAcceptedAt: data.tosAcceptedAt ? data.tosAcceptedAt.toDate() : null,
                    rateCount: data.rateCount,
                    uploadedImageIds: data.uploadedImageIds || [],
                    poolImageIds: data.poolImageIds || [],
                    displayName: data.displayName,
                    photoUrl: data.photoUrl,
                };
            }

            // Next, try to find by email
            const emailQuery = await transaction.get(
                this.collection.where('email', '==', googleData.email).limit(1),
            );

            if (!emailQuery.empty) {
                // User exists with this email but not Google ID, update it
                const doc = emailQuery.docs[0];
                transaction.update(doc.ref, { googleId: googleData.googleId });

                const data = doc.data() as UserDocument;
                return {
                    id: doc.id,
                    firebaseUid: data.firebaseUid,
                    email: data.email,
                    googleId: googleData.googleId, // Use the new Google ID
                    gender: data.gender,
                    dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toDate() : null,
                    tosVersion: data.tosVersion || null,
                    tosAcceptedAt: data.tosAcceptedAt ? data.tosAcceptedAt.toDate() : null,
                    rateCount: data.rateCount,
                    uploadedImageIds: data.uploadedImageIds || [],
                    poolImageIds: data.poolImageIds || [],
                    displayName: data.displayName,
                    photoUrl: data.photoUrl,
                };
            }

            // No existing user found, create a new one
            const newUserData: UserDocument = {
                firebaseUid: '', // This will need to be updated when migrating to Firebase Auth
                email: googleData.email,
                googleId: googleData.googleId,
                gender: 'unknown',
                dateOfBirth: null,
                tosVersion: null,
                tosAcceptedAt: null,
                rateCount: 0,
                uploadedImageIds: [],
                poolImageIds: [],
                displayName: null,
                photoUrl: null,
            };

            const newDocRef = this.collection.doc(); // Create a new document reference
            transaction.set(newDocRef, newUserData);

            return {
                id: newDocRef.id,
                firebaseUid: newUserData.firebaseUid,
                email: newUserData.email,
                googleId: newUserData.googleId,
                gender: newUserData.gender,
                dateOfBirth: null,
                tosVersion: null,
                tosAcceptedAt: null,
                rateCount: newUserData.rateCount,
                uploadedImageIds: newUserData.uploadedImageIds,
                poolImageIds: newUserData.poolImageIds,
                displayName: newUserData.displayName,
                photoUrl: newUserData.photoUrl,
            };
        });

        return result;
    }

    static async getUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
        const snapshot = await this.collection
            .where('firebaseUid', '==', firebaseUid)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        return this.documentToUser(snapshot.docs[0]);
    }

    static async createUserFromFirebase(data: {
        firebaseUid: string;
        email: string;
        displayName?: string | null;
        photoUrl?: string | null;
    }): Promise<User> {
        const newUserData: UserDocument = {
            firebaseUid: data.firebaseUid,
            email: data.email,
            googleId: null,
            gender: 'unknown',
            dateOfBirth: null,
            tosVersion: null,
            tosAcceptedAt: null,
            rateCount: 0,
            uploadedImageIds: [],
            poolImageIds: [],
            displayName: data.displayName || null,
            photoUrl: data.photoUrl || null,
        };

        const docRef = await this.collection.add(newUserData);

        return {
            id: docRef.id,
            ...newUserData,
            dateOfBirth: null,
            tosAcceptedAt: null,
        };
    }
}
