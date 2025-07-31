import { Router, Response } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { UserService } from '../services/user-service.js';
import { imageDataService } from '../services/image-data-service.js';

const router = Router();

// Update user profile
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.put('/profile', authMiddleware, (req: AuthRequest, res: Response): void => {
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
                dateOfBirthObj = new Date(dateOfBirth);
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

// Update user pool selections
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.put('/pool', authMiddleware, (req: AuthRequest, res: Response): void => {
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

            // Update Firestore image documents if there are changes
            if (updates.length > 0) {
                await imageDataService.batchUpdatePoolStatus(updates);
            }

            // Update user's pool selections
            const updatedUser = await UserService.updateUser(userId, {
                poolImageIds: poolImageIds,
            });

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
