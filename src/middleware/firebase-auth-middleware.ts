import { Request, Response, NextFunction } from 'express';
import { admin } from '../config/firebase-admin.js';
import { UserService } from '../services/user-service.js';
import { User } from '../types/user.js';

export interface AuthRequest extends Request {
    user?: User;
    firebaseUid?: string;
}

export const firebaseAuthMiddleware = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('Firebase Auth: No authorization header');
            res.status(401).json({ error: 'No token provided' });
            return;
        }

        const idToken = authHeader.split(' ')[1];
        console.log('Firebase Auth: Verifying token...');

        // Verify the Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log('Firebase Auth: Token verified for user:', decodedToken.email);

        // Check if email is verified
        if (!decodedToken.email_verified) {
            res.status(403).json({
                error: 'Please verify your email before accessing this resource',
            });
            return;
        }

        // Get or create user based on Firebase UID
        console.log('Firebase Auth: Looking for user with UID:', decodedToken.uid);
        let user = await UserService.getUserByFirebaseUid(decodedToken.uid);

        if (!user) {
            console.log('Firebase Auth: Creating new user...');
            // Create new user if doesn't exist
            user = await UserService.createUserFromFirebase({
                firebaseUid: decodedToken.uid,
                email: decodedToken.email || '',
                displayName: decodedToken.name as string | undefined,
                photoUrl: decodedToken.picture,
            });
            console.log('Firebase Auth: New user created:', user.id);
        } else {
            console.log('Firebase Auth: Existing user found:', user.id);
        }

        req.user = user;
        req.firebaseUid = decodedToken.uid;
        next();
    } catch (error) {
        console.error('Firebase auth error:', error);

        if (error instanceof Error) {
            if (error.message.includes('Firebase ID token has expired')) {
                res.status(401).json({ error: 'Token expired' });
            } else if (error.message.includes('Decoding Firebase ID token failed')) {
                res.status(401).json({ error: 'Invalid token' });
            } else {
                res.status(401).json({ error: 'Authentication failed' });
            }
        } else {
            res.status(401).json({ error: 'Authentication failed' });
        }
    }
};
