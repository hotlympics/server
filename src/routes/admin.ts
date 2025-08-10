import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '../config/firebase-admin.js';
import { UserService } from '../services/user-service.js';
import { imageDataService } from '../services/image-data-service.js';
import { storageService } from '../services/storage-service.js';
import { firestore, COLLECTIONS } from '../config/firestore.js';
import {
    adminAuthMiddleware,
    adminCredentials,
    type AdminRequest,
} from '../middleware/admin-auth-middleware.js';
import { Timestamp } from '@google-cloud/firestore';
import { GlickoState } from '../models/image-data.js';

interface UserDocument {
    firebaseUid: string;
    email: string;
    googleId: string | null;
    gender: 'unknown' | 'male' | 'female';
    dateOfBirth: Timestamp | null;
    rateCount: number;
    uploadedImageIds: string[];
    poolImageIds: string[];
    displayName?: string | null;
    photoUrl?: string | null;
}

interface ImageDataDocument {
    imageId: string;
    userId: string;
    imageUrl: string;
    gender: 'male' | 'female';
    dateOfBirth: Timestamp;
    battles: number;
    wins: number;
    losses: number;
    draws: number;
    glicko: GlickoState;
    inPool: boolean;
}

const router = Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 10, // Max 10 files
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    },
});

// Admin login
router.post('/login', (req, res: Response): void => {
    try {
        const { username, password } = req.body as { username: string; password: string };

        if (username !== adminCredentials.username || password !== adminCredentials.password) {
            res.status(401).json({ error: { message: 'Invalid admin credentials' } });
            return;
        }

        const token = jwt.sign({ isAdmin: true }, adminCredentials.secret, { expiresIn: '24h' });
        res.json({ token });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: { message: 'Login failed' } });
    }
});

// Get all users
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get('/users', adminAuthMiddleware, (_req: AdminRequest, res: Response): void => {
    (async () => {
        try {
            const snapshot = await firestore.collection(COLLECTIONS.USERS).get();
            const users = snapshot.docs.map((doc) => {
                const data = doc.data() as UserDocument;
                return {
                    id: doc.id,
                    ...data,
                    dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toDate().toISOString() : null,
                };
            });
            res.json({ users });
        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({ error: { message: 'Failed to fetch users' } });
        }
    })().catch(() => {
        // Error already handled in try-catch
    });
});

// Create new user
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post(
    '/users',
    adminAuthMiddleware,
    upload.array('images', 10),
    (req: AdminRequest, res: Response): void => {
        (async () => {
            try {
                const { email, displayName, gender, dateOfBirth, poolImageIndices } = req.body as {
                    email: string;
                    displayName?: string;
                    gender: 'male' | 'female';
                    dateOfBirth: string;
                    poolImageIndices?: string;
                };

                // Validate required fields
                if (!email || !gender || !dateOfBirth) {
                    res.status(400).json({
                        error: { message: 'Email, gender, and date of birth are required' },
                    });
                    return;
                }

                // Validate email format
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    res.status(400).json({ error: { message: 'Invalid email format' } });
                    return;
                }

                // Validate gender
                if (gender !== 'male' && gender !== 'female') {
                    res.status(400).json({
                        error: { message: 'Gender must be either "male" or "female"' },
                    });
                    return;
                }

                // Validate age (must be 18+)
                const birthDate = new Date(dateOfBirth);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                if (age < 18) {
                    res.status(400).json({
                        error: { message: 'User must be at least 18 years old' },
                    });
                    return;
                }

                // Check if email already exists
                const existingUserSnapshot = await firestore
                    .collection(COLLECTIONS.USERS)
                    .where('email', '==', email)
                    .get();

                if (!existingUserSnapshot.empty) {
                    res.status(400).json({
                        error: { message: 'User with this email already exists' },
                    });
                    return;
                }

                console.log(`Creating new user: ${email}`);

                // Generate a random password for Firebase Auth (user won't use this)
                const tempPassword = uuidv4();

                // 1. Create Firebase Auth user
                const userRecord = await auth.createUser({
                    email,
                    password: tempPassword,
                    displayName: displayName || undefined,
                });

                console.log(`Created Firebase Auth user: ${userRecord.uid}`);

                // 2. Create user document in Firestore
                const userData = {
                    firebaseUid: userRecord.uid,
                    email,
                    googleId: null,
                    gender,
                    dateOfBirth: Timestamp.fromDate(birthDate),
                    rateCount: 0,
                    uploadedImageIds: [],
                    poolImageIds: [],
                    displayName: displayName || null,
                    photoUrl: null,
                };

                const userDocRef = await firestore.collection(COLLECTIONS.USERS).add(userData);
                const userId = userDocRef.id;

                console.log(`Created user document: ${userId}`);

                // 3. Handle image uploads if any
                const files = req.files as Express.Multer.File[] | undefined;
                let uploadedImageCount = 0;
                const uploadedImageIds: string[] = [];

                if (files && files.length > 0) {
                    console.log(`Processing ${files.length} image uploads for user ${userId}`);

                    for (const file of files) {
                        try {
                            // Generate unique image ID
                            // TODO: Consider using Firestore auto-generated IDs (firestore.collection().doc().id) for consistency with user IDs and battle IDs
                            const imageId = uuidv4();

                            // Upload to Google Cloud Storage
                            const uploadResult = await storageService.uploadImage(file, imageId);
                            console.log(`Uploaded image: ${uploadResult.imageUrl}`);

                            // Create image data document using the service
                            await imageDataService.createImageData(
                                imageId,
                                userId,
                                uploadResult.imageUrl,
                                gender,
                                birthDate,
                            );

                            uploadedImageIds.push(imageId);
                            uploadedImageCount++;

                            console.log(`Created image data document: ${imageId}`);
                        } catch (imageError) {
                            console.error(`Failed to upload image for user ${userId}:`, imageError);
                            // Continue with other images even if one fails
                        }
                    }

                    // Update user document with uploaded image IDs
                    if (uploadedImageIds.length > 0) {
                        await firestore.collection(COLLECTIONS.USERS).doc(userId).update({
                            uploadedImageIds,
                        });
                        console.log(
                            `Updated user ${userId} with ${uploadedImageIds.length} image IDs`,
                        );
                    }
                }

                // 4. Handle pool image selection
                const poolImageIdsToAdd: string[] = [];
                if (poolImageIndices && uploadedImageIds.length > 0) {
                    try {
                        const indices = JSON.parse(poolImageIndices) as number[];

                        // Map indices to actual image IDs
                        for (const index of indices) {
                            if (index >= 0 && index < uploadedImageIds.length) {
                                poolImageIdsToAdd.push(uploadedImageIds[index]);
                            }
                        }

                        if (poolImageIdsToAdd.length > 0) {
                            // Update user document with pool image IDs
                            await firestore.collection(COLLECTIONS.USERS).doc(userId).update({
                                poolImageIds: poolImageIdsToAdd,
                            });

                            // Also update the inPool field in the image-data documents
                            const poolUpdatePromises = poolImageIdsToAdd.map((imageId) =>
                                firestore.collection(COLLECTIONS.IMAGE_DATA).doc(imageId).update({
                                    inPool: true,
                                }),
                            );
                            await Promise.all(poolUpdatePromises);

                            console.log(
                                `Added ${poolImageIdsToAdd.length} images to pool for user ${userId}`,
                            );
                        }
                    } catch (parseError) {
                        console.error('Failed to parse poolImageIndices:', parseError);
                        // Continue without adding to pool
                    }
                }

                res.status(201).json({
                    message: 'User created successfully',
                    userId,
                    uploadedImages: uploadedImageCount,
                    poolImages: poolImageIdsToAdd.length,
                });
            } catch (error) {
                console.error('Create user error:', error);
                res.status(500).json({ error: { message: 'Failed to create user' } });
            }
        })().catch(() => {
            // Error already handled in try-catch
        });
    },
);

// Get user details with images
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get('/users/:userId', adminAuthMiddleware, (req: AdminRequest, res: Response): void => {
    (async () => {
        try {
            const { userId } = req.params;

            // Get user data
            const user = await UserService.getUserById(userId);
            if (!user) {
                res.status(404).json({ error: { message: 'User not found' } });
                return;
            }

            // Get user's image data
            const imageDataSnapshot = await firestore
                .collection(COLLECTIONS.IMAGE_DATA)
                .where('userId', '==', userId)
                .get();

            const imageData = await Promise.all(
                imageDataSnapshot.docs.map(async (doc) => {
                    const data = doc.data() as ImageDataDocument;

                    // Generate signed URL for the image
                    let signedUrl = data.imageUrl; // Default to filename if signing fails
                    try {
                        signedUrl = await storageService.getSignedUrl(data.imageUrl);
                    } catch (error) {
                        console.error(
                            `Failed to generate signed URL for image ${data.imageId}:`,
                            error,
                        );
                    }

                    return {
                        id: doc.id,
                        imageId: data.imageId,
                        userId: data.userId,
                        imageUrl: signedUrl,
                        gender: data.gender,
                        dateOfBirth: data.dateOfBirth
                            ? data.dateOfBirth.toDate().toISOString()
                            : null,
                        battles: data.battles,
                        wins: data.wins,
                        losses: data.losses,
                        draws: data.draws,
                        rating: data.glicko.rating,
                        rd: data.glicko.rd,
                    };
                }),
            );

            res.json({
                user: {
                    ...user,
                    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString() : null,
                },
                imageData,
            });
        } catch (error) {
            console.error('Get user details error:', error);
            res.status(500).json({ error: { message: 'Failed to fetch user details' } });
        }
    })().catch(() => {
        // Error already handled in try-catch
    });
});

// Delete user completely
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.delete('/users/:userId', adminAuthMiddleware, (req: AdminRequest, res: Response): void => {
    (async () => {
        try {
            const { userId } = req.params;

            // Get user data first
            const user = await UserService.getUserById(userId);
            if (!user) {
                res.status(404).json({ error: { message: 'User not found' } });
                return;
            }

            console.log(`Starting deletion process for user: ${userId}`);

            // 1. Delete from Firebase Auth
            try {
                if (user.firebaseUid) {
                    await auth.deleteUser(user.firebaseUid);
                    console.log(`Deleted Firebase Auth user: ${user.firebaseUid}`);
                }
            } catch (authError) {
                console.warn(`Failed to delete Firebase Auth user ${user.firebaseUid}:`, authError);
                // Continue with deletion even if Firebase Auth fails
            }

            // 2. Get all image data for the user
            const imageDataSnapshot = await firestore
                .collection(COLLECTIONS.IMAGE_DATA)
                .where('userId', '==', userId)
                .get();

            // 3. Delete images from Google Cloud Storage
            const imageDeletePromises = imageDataSnapshot.docs.map(async (doc) => {
                const imageData = doc.data() as ImageDataDocument;
                const imageUrl = imageData.imageUrl;

                if (imageUrl) {
                    try {
                        await storageService.deleteImage(imageUrl);
                        console.log(`Deleted image from storage: ${imageUrl}`);
                    } catch (storageError) {
                        console.warn(`Failed to delete image ${imageUrl}:`, storageError);
                        // Continue with deletion even if storage deletion fails
                    }
                }
            });

            await Promise.all(imageDeletePromises);

            // 4. Delete image-data documents
            const batch = firestore.batch();
            imageDataSnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`Deleted ${imageDataSnapshot.docs.length} image-data documents`);

            // 5. Delete user document from Firestore
            await firestore.collection(COLLECTIONS.USERS).doc(userId).delete();
            console.log(`Deleted user document: ${userId}`);

            res.json({
                message: 'User deleted successfully',
                deletedUserId: userId,
                deletedImageCount: imageDataSnapshot.docs.length,
            });
        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({ error: { message: 'Failed to delete user' } });
        }
    })().catch(() => {
        // Error already handled in try-catch
    });
});

// Get admin dashboard stats
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get('/stats', adminAuthMiddleware, (_req: AdminRequest, res: Response): void => {
    (async () => {
        try {
            // Get user count
            const usersSnapshot = await firestore.collection(COLLECTIONS.USERS).get();
            const userCount = usersSnapshot.size;

            // Get image count
            const imagesSnapshot = await firestore.collection(COLLECTIONS.IMAGE_DATA).get();
            const imageCount = imagesSnapshot.size;

            // Get battle count by summing up battles from all images
            // Note: Each battle involves 2 images, so we divide by 2 to get unique battles
            let totalBattleEvents = 0;
            imagesSnapshot.docs.forEach((doc) => {
                const data = doc.data() as ImageDataDocument;
                totalBattleEvents += data.battles || 0;
            });
            const battleCount = Math.floor(totalBattleEvents / 2);

            // Get users by gender and count pool images
            let maleUsers = 0;
            let femaleUsers = 0;
            let unknownUsers = 0;
            let totalPoolImages = 0;

            usersSnapshot.docs.forEach((doc) => {
                const data = doc.data() as UserDocument;
                const gender = data.gender;
                if (gender === 'male') maleUsers++;
                else if (gender === 'female') femaleUsers++;
                else unknownUsers++;

                // Count pool images
                if (data.poolImageIds && Array.isArray(data.poolImageIds)) {
                    totalPoolImages += data.poolImageIds.length;
                }
            });

            res.json({
                totalUsers: userCount,
                totalImages: imageCount,
                totalBattles: battleCount,
                totalPoolImages: totalPoolImages,
                usersByGender: {
                    male: maleUsers,
                    female: femaleUsers,
                    unknown: unknownUsers,
                },
            });
        } catch (error) {
            console.error('Get stats error:', error);
            res.status(500).json({ error: { message: 'Failed to fetch stats' } });
        }
    })().catch(() => {
        // Error already handled in try-catch
    });
});

// Delete specific photo
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.delete('/photos/:imageId', adminAuthMiddleware, (req: AdminRequest, res: Response): void => {
    (async () => {
        try {
            const { imageId } = req.params;

            console.log(`Starting deletion process for image: ${imageId}`);

            // 1. Get image data first to find the userId and imageUrl
            const imageDoc = await firestore.collection(COLLECTIONS.IMAGE_DATA).doc(imageId).get();

            if (!imageDoc.exists) {
                res.status(404).json({ error: { message: 'Image not found' } });
                return;
            }

            const imageData = imageDoc.data() as ImageDataDocument;
            const userId = imageData.userId;
            const imageUrl = imageData.imageUrl;

            // 2. Delete image from Google Cloud Storage
            try {
                await storageService.deleteImage(imageUrl);
                console.log(`Deleted image from storage: ${imageUrl}`);
            } catch (storageError) {
                console.warn(`Failed to delete image ${imageUrl}:`, storageError);
                // Continue with deletion even if storage deletion fails
            }

            // 3. Delete image-data document from Firestore
            await firestore.collection(COLLECTIONS.IMAGE_DATA).doc(imageId).delete();
            console.log(`Deleted image-data document: ${imageId}`);

            // 4. Remove imageId from user's uploadedImageIds array
            const userDoc = await firestore.collection(COLLECTIONS.USERS).doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data() as UserDocument;
                const updatedUploadedImageIds = userData.uploadedImageIds.filter(
                    (id) => id !== imageId,
                );
                const updatedPoolImageIds = userData.poolImageIds.filter((id) => id !== imageId);

                await firestore.collection(COLLECTIONS.USERS).doc(userId).update({
                    uploadedImageIds: updatedUploadedImageIds,
                    poolImageIds: updatedPoolImageIds,
                });
                console.log(`Removed image ${imageId} from user ${userId} arrays`);
            }

            res.json({
                message: 'Photo deleted successfully',
                deletedImageId: imageId,
                userId: userId,
            });
        } catch (error) {
            console.error('Delete photo error:', error);
            res.status(500).json({ error: { message: 'Failed to delete photo' } });
        }
    })().catch(() => {
        // Error already handled in try-catch
    });
});

// Toggle photo pool status
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.put(
    '/photos/:imageId/pool',
    adminAuthMiddleware,
    (req: AdminRequest, res: Response): void => {
        (async () => {
            try {
                const { imageId } = req.params;
                const { userId, addToPool } = req.body as {
                    userId: string;
                    addToPool: boolean;
                };

                if (!userId || typeof addToPool !== 'boolean') {
                    res.status(400).json({
                        error: { message: 'userId and addToPool (boolean) are required' },
                    });
                    return;
                }

                // Get user document
                const userDoc = await firestore.collection(COLLECTIONS.USERS).doc(userId).get();
                if (!userDoc.exists) {
                    res.status(404).json({ error: { message: 'User not found' } });
                    return;
                }

                const userData = userDoc.data() as UserDocument;

                // Verify the image belongs to this user
                if (!userData.uploadedImageIds.includes(imageId)) {
                    res.status(400).json({
                        error: { message: 'Image does not belong to this user' },
                    });
                    return;
                }

                const currentPoolImageIds = userData.poolImageIds || [];
                const isCurrentlyInPool = currentPoolImageIds.includes(imageId);

                if (addToPool && isCurrentlyInPool) {
                    res.status(400).json({
                        error: { message: 'Image is already in the pool' },
                    });
                    return;
                }

                if (!addToPool && !isCurrentlyInPool) {
                    res.status(400).json({
                        error: { message: 'Image is not in the pool' },
                    });
                    return;
                }

                // Update pool status
                let updatedPoolImageIds: string[];
                if (addToPool) {
                    updatedPoolImageIds = [...currentPoolImageIds, imageId];
                    console.log(`Adding image ${imageId} to pool for user ${userId}`);
                } else {
                    updatedPoolImageIds = currentPoolImageIds.filter((id) => id !== imageId);
                    console.log(`Removing image ${imageId} from pool for user ${userId}`);
                }

                // Update user document
                await firestore.collection(COLLECTIONS.USERS).doc(userId).update({
                    poolImageIds: updatedPoolImageIds,
                });

                // Also update the inPool field in the image-data document
                await firestore.collection(COLLECTIONS.IMAGE_DATA).doc(imageId).update({
                    inPool: addToPool,
                });

                res.json({
                    message: addToPool
                        ? 'Photo added to pool successfully'
                        : 'Photo removed from pool successfully',
                    isInPool: addToPool,
                });
            } catch (error) {
                console.error('Toggle photo pool error:', error);
                res.status(500).json({ error: { message: 'Failed to toggle photo pool status' } });
            }
        })().catch(() => {
            // Error already handled in try-catch
        });
    },
);

export default router;
