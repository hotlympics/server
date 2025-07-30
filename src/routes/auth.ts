import { Router, Request, Response } from 'express';
import {
    verifyEmail,
    verifyPassword,
    hashPassword,
    verifyGoogleToken,
    generateToken,
    comparePassword,
} from '../utils/auth.js';
import { UserService } from '../services/user-service.js';

const router = Router();

// Email/Password Sign Up
router.post('/signup', (req: Request, res: Response): void => {
    (async () => {
        try {
            const { email, password } = req.body as { email: string; password: string };

            const emailVerified = verifyEmail(email);
            if (!emailVerified.result) {
                res.status(400).json({ error: emailVerified.message });
                return;
            }

            const passwordVerified = verifyPassword(password);
            if (!passwordVerified.result) {
                res.status(400).json({ error: passwordVerified.message });
                return;
            }

            // Check if user already exists
            const existingUser = await UserService.getUserByEmail(email);
            if (existingUser) {
                res.status(400).json({ error: 'User already exists' });
                return;
            }

            const hashedPassword = await hashPassword(password);

            // Create new user in Firestore
            const user = await UserService.createUser({
                email,
                googleId: null,
                password: hashedPassword,
                gender: 'unknown',
                dateOfBirth: null,
                rateCount: 0,
            });

            const token = generateToken(user);
            res.json({
                user: user,
                token: token,
            });
        } catch (error) {
            console.error('Signup error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    })().catch(() => {
        // Error already handled in try-catch
    });
});

// Email/Password Sign In
router.post('/signin', (req: Request, res: Response): void => {
    (async () => {
        console.log('Received signin request');
        try {
            const { email, password } = req.body as { email: string; password: string };

            const emailVerified = verifyEmail(email);
            if (!emailVerified.result) {
                res.status(400).json({ error: emailVerified.message });
                return;
            }

            // Get user from database
            const user = await UserService.getUserByEmail(email);
            if (!user) {
                res.status(401).json({ error: 'Invalid email or password' });
                return;
            }

            // Check if user has a password (not Google-only account)
            if (!user.password) {
                res.status(401).json({ error: 'Please sign in with Google' });
                return;
            }

            // Verify password
            const isValidPassword = await comparePassword(password, user.password);
            if (!isValidPassword) {
                res.status(401).json({ error: 'Invalid email or password' });
                return;
            }

            const token = generateToken(user);
            res.json({
                user: user,
                token: token,
            });
        } catch (error) {
            console.error('Signin error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    })().catch(() => {
        // Error already handled in try-catch
    });
});

// Google OAuth Callback
router.post('/google/callback', (req: Request, res: Response): void => {
    (async () => {
        console.log('Received Google OAuth callback');
        try {
            const { code } = req.body as { code: string };

            if (!code) {
                res.status(400).json({ error: 'Authorization code is required' });
                return;
            }

            const googleData = await verifyGoogleToken(code);

            if (!googleData) {
                res.status(400).json({ error: 'Invalid Google token' });
                return;
            }

            // Check if user exists by Google ID
            let user = await UserService.getUserByGoogleId(googleData.googleId);

            if (!user) {
                // Check if user exists by email
                user = await UserService.getUserByEmail(googleData.email);

                if (user) {
                    // User exists with email but not Google ID, update their Google ID
                    user = await UserService.updateUser(user.id, {
                        googleId: googleData.googleId,
                    });
                } else {
                    // Create new user
                    user = await UserService.createUser({
                        email: googleData.email,
                        googleId: googleData.googleId,
                        password: null,
                        gender: 'unknown',
                        dateOfBirth: null,
                        rateCount: 0,
                    });
                }
            }

            if (!user) {
                res.status(500).json({ error: 'Failed to create or retrieve user' });
                return;
            }

            const token = generateToken(user);
            res.json({
                user: user,
                token: token,
            });
        } catch (error) {
            console.error('Google auth error:', error);
            res.status(500).json({ error: 'Authentication failed' });
        }
    })().catch(() => {
        // Error already handled in try-catch
    });
});

export default router;
