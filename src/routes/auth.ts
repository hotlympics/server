import { Router, Request, Response } from 'express';
import { createUser, findUserByEmail, findUserByGoogleId } from '../models/user.js';
import { 
    hashPassword, 
    comparePassword, 
    generateToken, 
    verifyGoogleToken 
} from '../utils/auth.js';

const router = Router();

// Email/Password Sign Up
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
    console.log("Received signup request");
    try {
        const { email, password } = req.body;

        console.log(password);

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }

        if (password.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters' });
            return;
        }

        const existingUser = findUserByEmail(email);
        if (existingUser) {
            res.status(409).json({ error: 'User already exists' });
            return;
        }

        const hashedPassword = await hashPassword(password);
        const user = createUser({
            email,
            password: hashedPassword,
            provider: 'email',
        });

        const token = generateToken(user);

        res.json({
            user: {
                id: user.id,
                email: user.email,
                provider: user.provider,
                createdAt: user.createdAt,
                hasUploadedPhoto: user.hasUploadedPhoto,
                ratingCount: user.ratingCount,
            },
            token,
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Email/Password Sign In
router.post('/signin', async (req: Request, res: Response): Promise<void> => {
    console.log("Received signin request");
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }

        const user = findUserByEmail(email);
        if (!user || !user.password) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const isValidPassword = await comparePassword(password, user.password);
        if (!isValidPassword) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const token = generateToken(user);

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                provider: user.provider,
                createdAt: user.createdAt,
                hasUploadedPhoto: user.hasUploadedPhoto,
                ratingCount: user.ratingCount,
            },
            token,
        });
    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Google OAuth Callback
router.post('/google/callback', async (req: Request, res: Response): Promise<void> => {
    console.log("Received Google OAuth callback");
    try {
        const { code } = req.body;

        if (!code) {
            res.status(400).json({ error: 'Authorization code is required' });
            return;
        }

        const googleData = await verifyGoogleToken(code);

        let user = findUserByGoogleId(googleData.googleId);

        if (!user) {
            // Check if user exists with same email
            user = findUserByEmail(googleData.email);

            if (user && user.provider !== 'google') {
                res.status(409).json({ 
                    error: 'An account with this email already exists. Please sign in with email/password.' 
                });
                return;
            }

            // Create new user
            user = createUser({
                email: googleData.email,
                name: googleData.name,
                googleId: googleData.googleId,
                profilePicture: googleData.profilePicture,
                provider: 'google',
            });
        }

        const token = generateToken(user);

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                profilePicture: user.profilePicture,
                provider: user.provider,
                createdAt: user.createdAt,
                hasUploadedPhoto: user.hasUploadedPhoto,
                ratingCount: user.ratingCount,
            },
            token,
        });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

export default router;
