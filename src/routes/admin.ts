import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '../config/firebase-admin.js';
import { userService } from '../services/user-service.js';
import { imageDataService } from '../services/image-data-service.js';
import { battleHistoryService } from '../services/battle-history-service.js';
import { storageService } from '../services/storage-service.js';
import { firestore, COLLECTIONS } from '../config/firestore.js';
import {
    adminAuthMiddleware,
    adminCredentials,
    type AdminRequest,
} from '../middleware/admin-auth-middleware.js';
import { Timestamp } from '@google-cloud/firestore';
import { GlickoState } from '../models/image-data.js';
import { BattleHistory } from '../models/battle-history.js';

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

interface EnhancedBattle {
    battleId: string;
    winnerImageId: string;
    loserImageId: string;
    winnerUserId: string;
    loserUserId: string;
    winnerEmail: string;
    loserEmail: string;
    winnerRatingBefore: number;
    winnerRdBefore: number;
    loserRatingBefore: number;
    loserRdBefore: number;
    winnerRatingAfter: number;
    winnerRdAfter: number;
    loserRatingAfter: number;
    loserRdAfter: number;
    voterId?: string;
    voterEmail?: string;
    timestamp: string;
    systemVersion: number;
}

// Utility function to enhance battles with user emails
const enhanceBattlesWithEmails = async (battles: BattleHistory[]): Promise<EnhancedBattle[]> => {
    if (battles.length === 0) return [];

    // Extract unique user IDs
    const userIds = new Set<string>();
    battles.forEach((battle) => {
        userIds.add(battle.participants.winner.userId);
        userIds.add(battle.participants.loser.userId);
        if (battle.participants.voterId) {
            userIds.add(battle.participants.voterId);
        }
    });

    const uniqueUserIds = Array.from(userIds);
    const userEmailMap = new Map<string, string>();

    // Batch fetch users in chunks of 10 (Firestore 'in' operator limit)
    const chunkSize = 10;
    for (let i = 0; i < uniqueUserIds.length; i += chunkSize) {
        const chunk = uniqueUserIds.slice(i, i + chunkSize);

        try {
            const userQuery = await firestore
                .collection(COLLECTIONS.USERS)
                .where(
                    '__name__',
                    'in',
                    chunk.map((id) => firestore.collection(COLLECTIONS.USERS).doc(id)),
                )
                .get();

            userQuery.docs.forEach((doc) => {
                const userData = doc.data() as UserDocument;
                userEmailMap.set(doc.id, userData.email);
            });
        } catch (error) {
            console.warn(`Failed to fetch user chunk starting at index ${i}:`, error);
            // Continue with other chunks even if one fails
        }
    }

    // Enhance battles with email data
    return battles.map((battle) => ({
        battleId: battle.battleId,
        winnerImageId: battle.participants.winner.imageId,
        loserImageId: battle.participants.loser.imageId,
        winnerUserId: battle.participants.winner.userId,
        loserUserId: battle.participants.loser.userId,
        winnerEmail: userEmailMap.get(battle.participants.winner.userId) || 'deleted',
        loserEmail: userEmailMap.get(battle.participants.loser.userId) || 'deleted',
        winnerRatingBefore: battle.ratings.before.winner.rating,
        winnerRdBefore: battle.ratings.before.winner.rd,
        loserRatingBefore: battle.ratings.before.loser.rating,
        loserRdBefore: battle.ratings.before.loser.rd,
        winnerRatingAfter: battle.ratings.after.winner.rating,
        winnerRdAfter: battle.ratings.after.winner.rd,
        loserRatingAfter: battle.ratings.after.loser.rating,
        loserRdAfter: battle.ratings.after.loser.rd,
        voterId: battle.participants.voterId,
        voterEmail: battle.participants.voterId
            ? userEmailMap.get(battle.participants.voterId)
            : undefined,
        timestamp: battle.metadata.timestamp.toDate().toISOString(),
        systemVersion: battle.metadata.systemVersion,
    }));
};

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

// Get users with pagination
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get('/users', adminAuthMiddleware, (req: AdminRequest, res: Response): void => {
    (async () => {
        try {
            const limit = parseInt(req.query.limit as string) || 10;
            const startAfter = req.query.startAfter as string;

            let query = firestore.collection(COLLECTIONS.USERS).orderBy('__name__').limit(limit);

            if (startAfter) {
                query = query.startAfter(startAfter);
            }

            const snapshot = await query.get();
            const users = snapshot.docs.map((doc) => {
                const data = doc.data() as UserDocument;
                return {
                    id: doc.id,
                    ...data,
                    dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toDate().toISOString() : null,
                };
            });

            // Get the last document ID for next page cursor
            const lastDocId =
                snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null;
            const hasMore = snapshot.docs.length === limit;

            res.json({
                users,
                nextCursor: hasMore ? lastDocId : null,
                hasMore,
            });
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
                            // Use image data service for transactional pool updates
                            await imageDataService.addImagesToUserPool(userId, poolImageIdsToAdd);

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
            const user = await userService.getUserById(userId);
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
            const user = await userService.getUserById(userId);
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

                // Use image data service for transactional pool toggle
                await imageDataService.toggleImagePoolStatus(
                    userId,
                    imageId,
                    addToPool,
                    updatedPoolImageIds,
                );

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

// Search battles by image ID with emails
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get(
    '/battles/search-with-emails',
    adminAuthMiddleware,
    (req: AdminRequest, res: Response): void => {
        (async () => {
            try {
                const { imageId, limit = '50' } = req.query as {
                    imageId?: string;
                    limit?: string;
                };

                if (!imageId) {
                    res.status(400).json({
                        error: { message: 'imageId query parameter is required' },
                    });
                    return;
                }

                const searchLimit = Math.min(parseInt(limit, 10) || 50, 100);

                const battles = await battleHistoryService.getBattleHistoryForImage(
                    imageId,
                    searchLimit,
                );
                const enhancedBattles = await enhanceBattlesWithEmails(battles);

                res.json({
                    battles: enhancedBattles,
                    totalCount: enhancedBattles.length,
                    searchTerm: imageId,
                });
            } catch (error) {
                console.error('Search battles with emails error:', error);
                res.status(500).json({
                    error: { message: 'Failed to search battles with emails' },
                });
            }
        })().catch(() => {
            // Error already handled in try-catch
        });
    },
);

// Get image URL by image ID
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get(
    '/images/:imageId/url',
    adminAuthMiddleware,
    (req: AdminRequest, res: Response): void => {
        (async () => {
            try {
                const { imageId } = req.params;

                // Get image data from Firestore
                const imageSnapshot = await firestore
                    .collection(COLLECTIONS.IMAGE_DATA)
                    .where('imageId', '==', imageId)
                    .limit(1)
                    .get();

                if (imageSnapshot.empty) {
                    res.status(404).json({
                        error: { message: 'Image not found' },
                    });
                    return;
                }

                const imageDoc = imageSnapshot.docs[0];
                const imageData = imageDoc.data() as ImageDataDocument;

                // Generate signed URL
                let signedUrl = imageData.imageUrl; // Default to filename if signing fails
                try {
                    signedUrl = await storageService.getSignedUrl(imageData.imageUrl);
                } catch (error) {
                    console.error(`Failed to generate signed URL for image ${imageId}:`, error);
                }

                res.json({
                    imageId: imageData.imageId,
                    imageUrl: signedUrl,
                });
            } catch (error) {
                console.error('Get image URL error:', error);
                res.status(500).json({ error: { message: 'Failed to get image URL' } });
            }
        })().catch(() => {
            // Error already handled in try-catch
        });
    },
);

export default router;
