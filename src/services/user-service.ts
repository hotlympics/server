import { firestore } from '../config/firebase-admin.js';
import { COLLECTIONS } from '../config/firestore.js';
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
        // Use a transaction to ensure atomicity and prevent duplicate users by email
        const result = await firestore.runTransaction(async (transaction) => {
            // Check if a user with this email already exists
            const emailQuery = await transaction.get(
                this.collection.where('email', '==', userData.email).limit(1),
            );

            if (!emailQuery.empty) {
                // User with this email already exists, throw an error
                throw new Error(`User with email ${userData.email} already exists`);
            }

            // If firebaseUid is provided, check for duplicates by Firebase UID
            if (userData.firebaseUid) {
                const firebaseUidQuery = await transaction.get(
                    this.collection.where('firebaseUid', '==', userData.firebaseUid).limit(1),
                );

                if (!firebaseUidQuery.empty) {
                    // User with this Firebase UID already exists, throw an error
                    throw new Error(
                        `User with Firebase UID ${userData.firebaseUid} already exists`,
                    );
                }
            }

            // No existing user found, create a new one
            const documentData: UserDocument = {
                ...userData,
                dateOfBirth: userData.dateOfBirth ? Timestamp.fromDate(userData.dateOfBirth) : null,
                tosAcceptedAt: userData.tosAcceptedAt
                    ? Timestamp.fromDate(userData.tosAcceptedAt)
                    : null,
            };

            const newDocRef = this.collection.doc(); // Create a new document reference
            transaction.set(newDocRef, documentData);

            return {
                id: newDocRef.id,
                ...userData,
            };
        });

        return result;
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
        // Use a transaction to ensure atomicity and prevent duplicate users
        const result = await firestore.runTransaction(async (transaction) => {
            // First, try to find by Firebase UID
            const firebaseUidQuery = await transaction.get(
                this.collection.where('firebaseUid', '==', data.firebaseUid).limit(1),
            );

            if (!firebaseUidQuery.empty) {
                // User already exists with this Firebase UID
                const doc = firebaseUidQuery.docs[0];
                return this.documentToUser(doc)!;
            }

            // Next, try to find by email to prevent duplicate emails
            const emailQuery = await transaction.get(
                this.collection.where('email', '==', data.email).limit(1),
            );

            if (!emailQuery.empty) {
                // User exists with this email but different Firebase UID
                // Update the existing user with the new Firebase UID
                const doc = emailQuery.docs[0];
                transaction.update(doc.ref, { firebaseUid: data.firebaseUid });

                const existingData = doc.data() as UserDocument;
                return {
                    id: doc.id,
                    firebaseUid: data.firebaseUid, // Use the new Firebase UID
                    email: existingData.email,
                    googleId: existingData.googleId,
                    gender: existingData.gender,
                    dateOfBirth: existingData.dateOfBirth
                        ? existingData.dateOfBirth.toDate()
                        : null,
                    tosVersion: existingData.tosVersion || null,
                    tosAcceptedAt: existingData.tosAcceptedAt
                        ? existingData.tosAcceptedAt.toDate()
                        : null,
                    rateCount: existingData.rateCount,
                    uploadedImageIds: existingData.uploadedImageIds || [],
                    poolImageIds: existingData.poolImageIds || [],
                    displayName: existingData.displayName,
                    photoUrl: existingData.photoUrl,
                };
            }

            // No existing user found, create a new one
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
}
