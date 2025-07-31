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
import { FirebaseAuthService } from '../services/firebase-auth-service.js';

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
                if (existingUser.password) {
                    // User already has a password
                    res.status(400).json({ error: 'User already exists' });
                    return;
                } else {
                    // Google-only account, need to verify email before adding password
                    const hashedPassword = await hashPassword(password);

                    try {
                        const firebaseUid =
                            await FirebaseAuthService.createPasswordVerificationForGoogleUser(
                                email,
                                password,
                            );

                        // Store the hashed password and user ID temporarily
                        await FirebaseAuthService.storePendingUser(
                            firebaseUid,
                            email,
                            hashedPassword,
                        );

                        res.json({
                            status: 'pending_verification',
                            firebaseUid,
                            message: 'Please check your email to verify your account',
                            isGoogleUser: true,
                            userId: existingUser.id,
                        });
                        return;
                    } catch (error) {
                        console.error('Error creating Firebase user for Google account:', error);
                        res.status(500).json({
                            error:
                                error instanceof Error
                                    ? error.message
                                    : 'Failed to initiate verification',
                        });
                        return;
                    }
                }
            }

            // New user signup - require email verification
            const hashedPassword = await hashPassword(password);

            try {
                const firebaseUid = await FirebaseAuthService.createUnverifiedUser(email, password);

                // Store pending user data
                await FirebaseAuthService.storePendingUser(firebaseUid, email, hashedPassword);

                res.json({
                    status: 'pending_verification',
                    firebaseUid,
                    message: 'Please check your email to verify your account',
                });
            } catch (error) {
                console.error('Error creating Firebase user:', error);
                res.status(500).json({
                    error: error instanceof Error ? error.message : 'Failed to create user',
                });
            }
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

// Check email verification status
router.post('/verify-status', (req: Request, res: Response): void => {
    (async () => {
        try {
            const { firebaseUid, isGoogleUser, userId } = req.body as {
                firebaseUid: string;
                isGoogleUser?: boolean;
                userId?: string;
            };

            if (!firebaseUid) {
                res.status(400).json({ error: 'Firebase UID is required' });
                return;
            }

            const isVerified = await FirebaseAuthService.checkEmailVerified(firebaseUid);

            if (!isVerified) {
                res.json({ verified: false });
                return;
            }

            // Email is verified, complete the signup/password addition
            if (isGoogleUser && userId) {
                // Complete password addition for Google user
                const pendingDoc = await UserService.getUserById(userId);
                if (!pendingDoc) {
                    res.status(404).json({ error: 'User not found' });
                    return;
                }

                // Get the hashed password from pending data
                const pendingData = await FirebaseAuthService.getPendingUserData(firebaseUid);
                if (!pendingData) {
                    res.status(404).json({ error: 'Pending data not found' });
                    return;
                }

                const user = await FirebaseAuthService.completePasswordAddition(
                    firebaseUid,
                    userId,
                    pendingData.hashedPassword,
                );

                if (!user) {
                    res.status(500).json({ error: 'Failed to update user' });
                    return;
                }

                const token = generateToken(user);
                res.json({
                    verified: true,
                    user,
                    token,
                });
            } else {
                // Complete new user signup
                const user = await FirebaseAuthService.completeSignup(firebaseUid);

                if (!user) {
                    res.status(500).json({ error: 'Failed to create user' });
                    return;
                }

                const token = generateToken(user);
                res.json({
                    verified: true,
                    user,
                    token,
                });
            }
        } catch (error) {
            console.error('Verify status error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    })().catch(() => {
        // Error already handled in try-catch
    });
});

// Resend verification email
router.post('/resend-verification', (req: Request, res: Response): void => {
    (async () => {
        try {
            const { firebaseUid } = req.body as { firebaseUid: string };

            if (!firebaseUid) {
                res.status(400).json({ error: 'Firebase UID is required' });
                return;
            }

            await FirebaseAuthService.resendVerificationEmail(firebaseUid);
            res.json({ message: 'Verification email sent' });
        } catch (error) {
            console.error('Resend verification error:', error);
            res.status(500).json({
                error:
                    error instanceof Error ? error.message : 'Failed to resend verification email',
            });
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

            // Use transaction-based method to prevent race conditions
            const user = await UserService.findOrCreateGoogleUser({
                email: googleData.email,
                googleId: googleData.googleId,
            });

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
