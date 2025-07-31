import { Router, Response } from 'express';
import {
    firebaseAuthMiddleware,
    type AuthRequest,
} from '../middleware/firebase-auth-middleware.js';

const router = Router();

// Firebase Auth Sync - called after successful Firebase authentication
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post('/sync', firebaseAuthMiddleware, (req: AuthRequest, res: Response): void => {
    // User is already authenticated and attached to request by middleware
    const user = req.user;

    if (!user) {
        res.status(500).json({ error: 'User not found' });
        return;
    }

    res.json({ user });
});

export default router;
