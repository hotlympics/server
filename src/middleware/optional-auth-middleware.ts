import { Response, NextFunction } from 'express';
import { admin } from '../config/firebase-admin.js';
import { UserService } from '../services/user-service.js';
import { AuthRequest } from './firebase-auth-middleware.js';

export const optionalAuthMiddleware = async (
    req: AuthRequest,
    _res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        // If no auth header, continue without user
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            req.user = undefined;
            req.firebaseUid = undefined;
            next();
            return;
        }

        const idToken = authHeader.split(' ')[1];

        try {
            // Verify the Firebase ID token
            const decodedToken = await admin.auth().verifyIdToken(idToken);

            // Check if email is verified
            if (!decodedToken.email_verified) {
                // For optional auth, we just skip setting the user if email not verified
                req.user = undefined;
                req.firebaseUid = undefined;
                next();
                return;
            }

            // Get or create user based on Firebase UID
            let user = await UserService.getUserByFirebaseUid(decodedToken.uid);

            if (!user) {
                // Create new user if doesn't exist
                user = await UserService.createUserFromFirebase({
                    firebaseUid: decodedToken.uid,
                    email: decodedToken.email || '',
                    displayName: decodedToken.name as string | undefined,
                    photoUrl: decodedToken.picture,
                });
            }

            req.user = user;
            req.firebaseUid = decodedToken.uid;
        } catch (error) {
            // For optional auth, we just continue without user on any error
            console.warn('Optional auth token verification failed:', error);
            req.user = undefined;
            req.firebaseUid = undefined;
        }

        next();
    } catch (error) {
        // For optional auth, any error just means no user
        console.error('Optional auth middleware error:', error);
        req.user = undefined;
        req.firebaseUid = undefined;
        next();
    }
};
