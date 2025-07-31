import { auth } from '../config/firebase-admin.js';
import { firestore } from '../config/firestore.js';
import { User } from '../types/user.js';
import { UserService } from './user-service.js';

interface PendingUser {
    email: string;
    hashedPassword: string;
    timestamp: Date;
    firebaseUid: string;
}

// Collection for storing pending user signups
const PENDING_USERS_COLLECTION = 'pending_users';

export class FirebaseAuthService {
    /**
     * Create a new user in Firebase Auth and send verification email
     */
    static async createUnverifiedUser(email: string, password: string): Promise<string> {
        try {
            // Create user in Firebase Auth
            const userRecord = await auth.createUser({
                email,
                password,
                emailVerified: false,
            });

            // Generate verification link
            const link = await auth.generateEmailVerificationLink(email);
            console.log('Email verification link generated:', link);

            // In production, you would send this link via email service
            // For now, we'll log it and rely on Firebase's automatic email

            return userRecord.uid;
        } catch (error) {
            if (
                error &&
                typeof error === 'object' &&
                'code' in error &&
                error.code === 'auth/email-already-exists'
            ) {
                throw new Error('Email already in use');
            }
            throw error;
        }
    }

    /**
     * Store pending user data temporarily
     */
    static async storePendingUser(
        firebaseUid: string,
        email: string,
        hashedPassword: string,
    ): Promise<void> {
        const pendingUser: PendingUser = {
            email,
            hashedPassword,
            timestamp: new Date(),
            firebaseUid,
        };

        await firestore.collection(PENDING_USERS_COLLECTION).doc(firebaseUid).set(pendingUser);
    }

    /**
     * Check if email is verified in Firebase Auth
     */
    static async checkEmailVerified(firebaseUid: string): Promise<boolean> {
        try {
            const userRecord = await auth.getUser(firebaseUid);
            return userRecord.emailVerified;
        } catch (error) {
            console.error('Error checking email verification:', error);
            return false;
        }
    }

    /**
     * Complete user signup after email verification
     */
    static async completeSignup(firebaseUid: string): Promise<User | null> {
        try {
            // Get pending user data
            const pendingDoc = await firestore
                .collection(PENDING_USERS_COLLECTION)
                .doc(firebaseUid)
                .get();

            if (!pendingDoc.exists) {
                throw new Error('Pending user data not found');
            }

            const pendingData = pendingDoc.data() as PendingUser;

            // Check if user already exists (race condition protection)
            const existingUser = await UserService.getUserByEmail(pendingData.email);
            if (existingUser) {
                // Clean up pending data
                await firestore.collection(PENDING_USERS_COLLECTION).doc(firebaseUid).delete();
                return existingUser;
            }

            // Create user in Firestore
            const user = await UserService.createUser({
                email: pendingData.email,
                googleId: null,
                password: pendingData.hashedPassword,
                gender: 'unknown',
                dateOfBirth: null,
                rateCount: 0,
                uploadedImageIds: [],
                poolImageIds: [],
            });

            // Clean up pending data
            await firestore.collection(PENDING_USERS_COLLECTION).doc(firebaseUid).delete();

            return user;
        } catch (error) {
            console.error('Error completing signup:', error);
            throw error;
        }
    }

    /**
     * Handle Google user adding password with email verification
     */
    static async createPasswordVerificationForGoogleUser(
        email: string,
        password: string,
    ): Promise<string> {
        try {
            // Create a Firebase Auth user for verification purposes
            const userRecord = await auth.createUser({
                email,
                password,
                emailVerified: false,
            });

            // Generate verification link
            const link = await auth.generateEmailVerificationLink(email);
            console.log('Email verification link generated for Google user:', link);

            return userRecord.uid;
        } catch (error) {
            if (
                error &&
                typeof error === 'object' &&
                'code' in error &&
                error.code === 'auth/email-already-exists'
            ) {
                // This might happen if they already tried to set a password
                // Get the existing user and resend verification
                const existingUser = await auth.getUserByEmail(email);
                if (!existingUser.emailVerified) {
                    const link = await auth.generateEmailVerificationLink(email);
                    console.log('Resending verification link:', link);
                }
                return existingUser.uid;
            }
            throw error;
        }
    }

    /**
     * Complete password addition for Google user after verification
     */
    static async completePasswordAddition(
        firebaseUid: string,
        userId: string,
        hashedPassword: string,
    ): Promise<User | null> {
        try {
            // Verify email is confirmed
            const isVerified = await this.checkEmailVerified(firebaseUid);
            if (!isVerified) {
                throw new Error('Email not verified');
            }

            // Update user with password
            const updatedUser = await UserService.updateUser(userId, {
                password: hashedPassword,
            });

            // Clean up Firebase Auth user (we don't need it anymore)
            // Keep this commented for now - might want to keep for future features
            // await auth.deleteUser(firebaseUid);

            return updatedUser;
        } catch (error) {
            console.error('Error completing password addition:', error);
            throw error;
        }
    }

    /**
     * Resend verification email
     */
    static async resendVerificationEmail(firebaseUid: string): Promise<void> {
        try {
            const userRecord = await auth.getUser(firebaseUid);
            if (userRecord.emailVerified) {
                throw new Error('Email already verified');
            }

            const link = await auth.generateEmailVerificationLink(userRecord.email!);
            console.log('Resending verification email:', link);
            // In production, send this via email service
        } catch (error) {
            console.error('Error resending verification email:', error);
            throw error;
        }
    }

    /**
     * Get pending user data
     */
    static async getPendingUserData(firebaseUid: string): Promise<PendingUser | null> {
        try {
            const doc = await firestore.collection(PENDING_USERS_COLLECTION).doc(firebaseUid).get();

            if (!doc.exists) {
                return null;
            }

            return doc.data() as PendingUser;
        } catch (error) {
            console.error('Error getting pending user data:', error);
            return null;
        }
    }

    /**
     * Clean up expired pending users (call this periodically)
     */
    static async cleanupExpiredPendingUsers(): Promise<void> {
        const expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() - 24); // 24 hours expiration

        const expiredUsers = await firestore
            .collection(PENDING_USERS_COLLECTION)
            .where('timestamp', '<', expirationTime)
            .get();

        const batch = firestore.batch();
        const deletePromises: Promise<void>[] = [];

        expiredUsers.forEach((doc) => {
            batch.delete(doc.ref);
            // Also delete from Firebase Auth
            deletePromises.push(auth.deleteUser(doc.id).catch(() => {}));
        });

        await Promise.all([batch.commit(), ...deletePromises]);
        console.log(`Cleaned up ${expiredUsers.size} expired pending users`);
    }
}
