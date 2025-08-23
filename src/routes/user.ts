import { Router, Response } from 'express';
import {
    firebaseAuthMiddleware,
    type AuthRequest,
} from '../middleware/firebase-auth-middleware.js';
import { UserService } from '../services/user-service.js';
import { imageDataService } from '../services/image-data-service.js';
import { CURRENT_TOS_VERSION } from '../config/tos-config.js';

const router = Router();

// Get current user info
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get('/', firebaseAuthMiddleware, (req: AuthRequest, res: Response): void => {
    try {
        // The user data is already attached to the request by the middleware
        const user = req.user!;
        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: { message: 'Failed to get user info' } });
    }
});

// Update user profile
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.put('/profile', firebaseAuthMiddleware, (req: AuthRequest, res: Response): void => {
    (async () => {
        try {
            const userId = req.user!.id;
            const { gender, dateOfBirth } = req.body as {
                gender?: 'male' | 'female';
                dateOfBirth?: string;
            };

            // Validate gender
            if (gender && !['male', 'female'].includes(gender)) {
                res.status(400).json({ error: { message: 'Invalid gender value' } });
                return;
            }

            // Validate date of birth
            let dateOfBirthObj: Date | null = null;
            if (dateOfBirth) {
                // Parse date as UTC midnight to avoid timezone issues
                if (dateOfBirth.includes('-') && dateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    // ISO format YYYY-MM-DD from date input
                    const [year, month, day] = dateOfBirth.split('-').map(Number);
                    dateOfBirthObj = new Date(Date.UTC(year, month - 1, day));
                } else {
                    // Fallback to default parsing for other formats
                    dateOfBirthObj = new Date(dateOfBirth);
                }
                if (isNaN(dateOfBirthObj.getTime())) {
                    res.status(400).json({ error: { message: 'Invalid date of birth' } });
                    return;
                }

                // Check if date is in the future
                if (dateOfBirthObj > new Date()) {
                    res.status(400).json({
                        error: { message: 'Date of birth cannot be in the future' },
                    });
                    return;
                }

                // Check if user is at least 18 years old
                const today = new Date();
                const age = today.getFullYear() - dateOfBirthObj.getFullYear();
                const monthDiff = today.getMonth() - dateOfBirthObj.getMonth();
                const dayDiff = today.getDate() - dateOfBirthObj.getDate();
                const isUnder18 =
                    age < 18 || (age === 18 && (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)));

                if (isUnder18) {
                    res.status(400).json({
                        error: { message: 'You must be at least 18 years old' },
                    });
                    return;
                }
            }

            // Update user
            const updatedUser = await UserService.updateUser(userId, {
                gender: gender || req.user!.gender,
                dateOfBirth: dateOfBirthObj || req.user!.dateOfBirth,
            });

            res.json(updatedUser);
        } catch (error) {
            console.error('Profile update error:', error);
            res.status(500).json({ error: { message: 'Failed to update profile' } });
        }
    })().catch(() => {
        // Error already handled in try-catch
    });
});

// Accept Terms of Service
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post('/accept-tos', firebaseAuthMiddleware, (req: AuthRequest, res: Response): void => {
    (async () => {
        try {
            const userId = req.user!.id;
            const { tosVersion } = req.body as { tosVersion?: string };

            // Validate TOS version
            if (!tosVersion) {
                res.status(400).json({ error: { message: 'TOS version is required' } });
                return;
            }

            // Check if the provided version matches the current version
            if (tosVersion !== CURRENT_TOS_VERSION) {
                res.status(400).json({
                    error: {
                        message: 'Invalid TOS version. Please refresh and try again.',
                        currentVersion: CURRENT_TOS_VERSION,
                    },
                });
                return;
            }

            // Update user with TOS acceptance
            const updatedUser = await UserService.updateUser(userId, {
                tosVersion: CURRENT_TOS_VERSION,
                tosAcceptedAt: new Date(),
            });

            res.json({
                success: true,
                user: updatedUser,
                message: 'Terms of Service accepted successfully',
            });
        } catch (error) {
            console.error('TOS acceptance error:', error);
            res.status(500).json({ error: { message: 'Failed to accept Terms of Service' } });
        }
    })().catch(() => {
        // Error already handled in try-catch
    });
});

// Update user pool selections
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.put('/pool', firebaseAuthMiddleware, (req: AuthRequest, res: Response): void => {
    (async () => {
        try {
            const userId = req.user!.id;
            const { poolImageIds } = req.body as {
                poolImageIds?: string[];
            };

            // Validate pool selections
            if (!Array.isArray(poolImageIds)) {
                res.status(400).json({ error: { message: 'poolImageIds must be an array' } });
                return;
            }

            if (poolImageIds.length > 2) {
                res.status(400).json({ error: { message: 'Maximum 2 images can be in the pool' } });
                return;
            }

            // Verify that all selected images belong to the user
            const user = req.user!;
            const invalidIds = poolImageIds.filter((id) => !user.uploadedImageIds.includes(id));

            if (invalidIds.length > 0) {
                res.status(400).json({
                    error: {
                        message: 'Invalid image IDs: You can only add your own images to the pool',
                    },
                });
                return;
            }

            // Get current pool selections to determine what changed
            const currentPoolIds = user.poolImageIds || [];

            // Determine which images to add/remove from pool
            const toAddToPool = poolImageIds.filter((id) => !currentPoolIds.includes(id));
            const toRemoveFromPool = currentPoolIds.filter((id) => !poolImageIds.includes(id));

            // Prepare batch updates for Firestore
            const updates: Array<{ imageId: string; inPool: boolean }> = [
                ...toAddToPool.map((imageId) => ({ imageId, inPool: true })),
                ...toRemoveFromPool.map((imageId) => ({ imageId, inPool: false })),
            ];

            // Use image data service for transactional pool updates
            await imageDataService.updateUserPoolStatus(userId, poolImageIds, updates);

            // Get updated user data to return
            const updatedUser = await UserService.getUserById(userId);

            res.json(updatedUser);
        } catch (error) {
            console.error('Pool update error:', error);
            res.status(500).json({ error: { message: 'Failed to update pool selections' } });
        }
    })().catch(() => {
        // Error already handled in try-catch
    });
});

export default router;
