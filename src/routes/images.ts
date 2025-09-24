import { Router, Request, Response, NextFunction } from 'express';
import { upload } from '../middleware/upload-middleware.js';
import { storageService } from '../services/storage-service.js';
import {
    firebaseAuthMiddleware,
    type AuthRequest,
} from '../middleware/firebase-auth-middleware.js';
import { optionalAuthMiddleware } from '../middleware/optional-auth-middleware.js';
import { imageDataService } from '../services/image-data-service.js';
import { v4 as uuidv4 } from 'uuid';
import { firestore } from '../config/firestore.js';
import { userService } from '../services/user-service.js';
import { GlickoState } from '../types/image-data.js';
import { Timestamp } from '@google-cloud/firestore';
import { metadataService } from '../services/metadata-service.js';

const router = Router();

const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

router.post(
    '/request-upload',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    firebaseAuthMiddleware,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            if (!req.user?.id) {
                res.status(401).json({
                    error: {
                        message: 'User not authenticated',
                        status: 401,
                    },
                });
                return;
            }

            // Get file extension from request body
            const { fileExtension = 'jpg' } = req.body as { fileExtension?: string };

            // Check user's current photo count from user document
            const user = await userService.getUserById(req.user.id);
            if (!user) {
                res.status(404).json({
                    error: {
                        message: 'User not found',
                        status: 404,
                    },
                });
                return;
            }

            // Check if user has less than 10 images
            if (user.uploadedImageIds.length >= 10) {
                res.status(400).json({
                    error: {
                        message: "You've reached the maximum limit of 10 photos",
                        status: 400,
                    },
                });
                return;
            }

            // Check if user has gender and dateOfBirth set
            if (user.gender === 'unknown' || !user.dateOfBirth) {
                res.status(400).json({
                    error: {
                        message:
                            'Please set your gender and date of birth in your profile before uploading images',
                        status: 400,
                    },
                });
                return;
            }

            // Generate a unique imageId
            // TODO: Consider using Firestore auto-generated IDs (firestore.collection().doc().id) for consistency with user IDs and battle IDs
            const imageId = uuidv4();
            const fileName = `${imageId}.${fileExtension}`;

            // Pre-create image data record with pending status
            await imageDataService.createImageData(
                imageId,
                req.user.id,
                fileName,
                user.gender,
                user.dateOfBirth,
                { status: 'pending' },
            );

            // Add image ID to user's uploadedImageIds array
            await userService.addUploadedImageId(req.user.id, imageId);

            // Generate signed upload URL
            const { uploadUrl, downloadUrl } = await storageService.getSignedUploadUrl(fileName);

            res.json({
                success: true,
                imageId: imageId,
                uploadUrl: uploadUrl,
                downloadUrl: downloadUrl,
                fileName: fileName,
                message: 'Upload URL generated successfully',
            });
        } catch (error) {
            console.error('Upload URL generation error:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to generate upload URL',
                    status: 500,
                },
            });
        }
    }),
);

router.post(
    '/upload',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    firebaseAuthMiddleware,
    upload.single('image'),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            if (!req.file) {
                res.status(400).json({
                    error: {
                        message: 'No image file provided',
                        status: 400,
                    },
                });
                return;
            }

            if (!req.user?.id) {
                res.status(401).json({
                    error: {
                        message: 'User not authenticated',
                        status: 401,
                    },
                });
                return;
            }

            // Check user's current photo count from user document
            const user = await userService.getUserById(req.user.id);
            if (!user) {
                res.status(404).json({
                    error: {
                        message: 'User not found',
                        status: 404,
                    },
                });
                return;
            }

            // Check if user has less than 10 images
            if (user.uploadedImageIds.length >= 10) {
                res.status(400).json({
                    error: {
                        message: "You've reached the maximum limit of 10 photos",
                        status: 400,
                    },
                });
                return;
            }

            // Check if user has gender and dateOfBirth set
            if (user.gender === 'unknown' || !user.dateOfBirth) {
                res.status(400).json({
                    error: {
                        message:
                            'Please set your gender and date of birth in your profile before uploading images',
                        status: 400,
                    },
                });
                return;
            }

            // Generate a unique imageId
            // TODO: Consider using Firestore auto-generated IDs (firestore.collection().doc().id) for consistency with user IDs and battle IDs
            const imageId = uuidv4();

            // Upload to GCS with the imageId
            const { imageUrl: fileName } = await storageService.uploadImage(req.file, imageId);

            // Create image data record in Firestore with user's gender and dateOfBirth
            // Store the filename in Firestore (not the full URL)
            await imageDataService.createImageData(
                imageId,
                req.user.id,
                fileName,
                user.gender,
                user.dateOfBirth,
            );

            // Add image ID to user's uploadedImageIds array
            await userService.addUploadedImageId(req.user.id, imageId);

            // Generate signed URL for the uploaded image
            const signedUrl = await storageService.getSignedUrl(fileName);

            res.json({
                success: true,
                imageId: imageId,
                imageUrl: signedUrl,
                message: 'Image uploaded successfully',
            });
        } catch (error) {
            console.error('Image upload error:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to upload image',
                    status: 500,
                },
            });
        }
    }),
);

router.get(
    '/user',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    firebaseAuthMiddleware,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            if (!req.user?.id) {
                res.status(401).json({
                    error: {
                        message: 'User not authenticated',
                        status: 401,
                    },
                });
                return;
            }

            // Get user data to access uploadedImageIds
            const user = await userService.getUserById(req.user.id);
            if (!user) {
                res.status(404).json({
                    error: {
                        message: 'User not found',
                        status: 404,
                    },
                });
                return;
            }

            // Map image IDs to signed URLs
            const userImages = await Promise.all(
                user.uploadedImageIds.map(async (imageId) => {
                    try {
                        // Find the actual filename with extension
                        const fileName = await storageService.findImageByIdPrefix(imageId);
                        if (!fileName) {
                            return null;
                        }

                        // Generate signed URL
                        const signedUrl = await storageService.getSignedUrl(fileName);
                        return {
                            id: imageId,
                            url: signedUrl,
                        };
                    } catch (error) {
                        console.error(`Failed to generate signed URL for image ${imageId}:`, error);
                        return null;
                    }
                }),
            );

            // Filter out any null results
            const validUserImages = userImages.filter((img) => img !== null) as Array<{
                id: string;
                url: string;
            }>;

            // Return in reverse order (newest first) based on array position
            res.json(validUserImages.reverse());
        } catch (error) {
            console.error('Error fetching user images:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to fetch user images',
                    status: 500,
                },
            });
        }
    }),
);

router.get(
    '/user/withmetadata',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    firebaseAuthMiddleware,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            if (!req.user?.id) {
                res.status(401).json({
                    error: {
                        message: 'User not authenticated',
                        status: 401,
                    },
                });
                return;
            }

            // Get user data to access uploadedImageIds
            const user = await userService.getUserById(req.user.id);
            if (!user) {
                res.status(404).json({
                    error: {
                        message: 'User not found',
                        status: 404,
                    },
                });
                return;
            }

            // Map image IDs to signed URLs and metadata
            const userImagesWithMetadata = await Promise.all(
                user.uploadedImageIds.map(async (imageId) => {
                    try {
                        // Get image metadata from image-data collection
                        const imageDataDoc = await firestore
                            .collection('image-data')
                            .doc(imageId)
                            .get();
                        if (!imageDataDoc.exists) {
                            console.error(`Image data not found for imageId: ${imageId}`);
                            return null;
                        }

                        const imageData = imageDataDoc.data();
                        if (!imageData) {
                            return null;
                        }

                        // Find the actual filename with extension
                        const fileName = await storageService.findImageByIdPrefix(imageId);
                        if (!fileName) {
                            return null;
                        }

                        // Generate signed URL
                        const signedUrl = await storageService.getSignedUrl(fileName);

                        return {
                            id: imageId,
                            url: signedUrl,
                            battles: imageData.battles as number,
                            wins: imageData.wins as number,
                            losses: imageData.losses as number,
                            draws: imageData.draws as number,
                            glicko: imageData.glicko as GlickoState,
                            inPool: imageData.inPool as boolean,
                            status: imageData.status as 'pending' | 'active' | undefined,
                            gender: imageData.gender as 'male' | 'female',
                            dateOfBirth: imageData.dateOfBirth as Timestamp,
                            createdAt: imageData.createdAt as Timestamp,
                            uploadedAt: imageData.uploadedAt as Timestamp | undefined,
                            randomSeed: imageData.randomSeed as number,
                        };
                    } catch (error) {
                        console.error(`Failed to fetch metadata for image ${imageId}:`, error);
                        return null;
                    }
                }),
            );

            // Filter out any null results
            const validUserImages = userImagesWithMetadata.filter((img) => img !== null);

            // Return in reverse order (newest first) based on array position
            res.json(validUserImages.reverse());
        } catch (error) {
            console.error('Error fetching user images with metadata:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to fetch user images with metadata',
                    status: 500,
                },
            });
        }
    }),
);

router.delete(
    '/:imageId',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    firebaseAuthMiddleware,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { imageId } = req.params;

            if (!req.user?.id) {
                res.status(401).json({
                    error: {
                        message: 'User not authenticated',
                        status: 401,
                    },
                });
                return;
            }

            // Get user to verify ownership
            const user = await userService.getUserById(req.user.id);
            if (!user) {
                res.status(404).json({
                    error: {
                        message: 'User not found',
                        status: 404,
                    },
                });
                return;
            }

            // Check if the imageId is in the user's uploadedImageIds
            if (!user.uploadedImageIds.includes(imageId)) {
                res.status(404).json({
                    error: {
                        message: 'Image not found or does not belong to user',
                        status: 404,
                    },
                });
                return;
            }

            // Find the actual filename in storage
            const fileNameToDelete = await storageService.findImageByIdPrefix(imageId);
            if (!fileNameToDelete) {
                res.status(404).json({
                    error: {
                        message: 'Image file not found in storage',
                        status: 404,
                    },
                });
                return;
            }

            // Get image data before deletion to update metadata
            const imageDoc = await firestore.collection('image-data').doc(imageId).get();
            const imageData = imageDoc.exists ? imageDoc.data() : null;
            const wasInPool = imageData?.inPool === true;

            // Delete from GCS
            await storageService.deleteImage(fileNameToDelete);

            // Delete the image-data document completely
            await firestore.collection('image-data').doc(imageId).delete();

            // Remove image ID from user's uploadedImageIds array
            await userService.removeUploadedImageId(req.user.id, imageId);

            // Also remove from poolImageIds if it was in the pool
            if (user.poolImageIds.includes(imageId)) {
                await userService.removePoolImageId(req.user.id, imageId);
            }

            // Update metadata
            await metadataService.decrementTotalImages();
            if (wasInPool) {
                await metadataService.decrementPoolImages();
            }

            res.json({
                success: true,
                message: 'Image deleted successfully',
            });
        } catch (error) {
            console.error('Image deletion error:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to delete image',
                    status: 500,
                },
            });
        }
    }),
);

router.post(
    '/confirm-upload/:imageId',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    firebaseAuthMiddleware,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { imageId } = req.params;
            let { actualFileName } = req.body as { actualFileName: string };

            if (!req.user?.id) {
                res.status(401).json({
                    error: {
                        message: 'User not authenticated',
                        status: 401,
                    },
                });
                return;
            }

            // Verify the user owns this image
            const user = await userService.getUserById(req.user.id);
            if (!user || !user.uploadedImageIds.includes(imageId)) {
                res.status(403).json({
                    error: {
                        message: 'Unauthorized to confirm this upload',
                        status: 403,
                    },
                });
                return;
            }

            // Verify image exists in storage
            console.log('Verifying upload for file:', actualFileName);
            const exists = await storageService.verifyImageExists(actualFileName);

            if (!exists) {
                console.log('File not found in storage:', actualFileName);
                console.log('Checking for file with imageId prefix:', imageId);

                // Try to find the file by prefix in case extension differs
                const foundFile = await storageService.findImageByIdPrefix(imageId);
                if (foundFile) {
                    console.log('Found file with different name:', foundFile);
                    // Update with correct filename
                    actualFileName = foundFile;
                } else {
                    // Rollback: Remove from user's array and delete record
                    await userService.removeUploadedImageId(req.user.id, imageId);
                    await firestore.collection('image-data').doc(imageId).delete();

                    res.status(400).json({
                        error: {
                            message: 'Upload verification failed',
                            status: 400,
                        },
                    });
                    return;
                }
            }

            // Update image record status
            await imageDataService.updateImageStatus(imageId, {
                status: 'active',
                fileName: actualFileName,
                uploadedAt: new Date(),
            });

            res.json({
                success: true,
                message: 'Upload confirmed successfully',
            });
        } catch (error) {
            console.error('Upload confirmation error:', error);
            res.status(500).json({
                error: {
                    message: 'Failed to confirm upload',
                    status: 500,
                },
            });
        }
    }),
);

router.get(
    '/block',
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    optionalAuthMiddleware,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { gender, count } = req.query as { gender?: string; count?: string };

            if (!count) {
                res.status(400).json({
                    error: {
                        message: 'Count parameter is required',
                        status: 400,
                    },
                });
                return;
            }

            const imageCount = parseInt(count, 10);
            if (isNaN(imageCount) || imageCount < 1 || imageCount > 100) {
                res.status(400).json({
                    error: {
                        message: 'count must be a number between 1 and 100',
                        status: 400,
                    },
                });
                return;
            }

            const criteria: { gender?: 'male' | 'female' } = {};

            if (gender) {
                if (gender !== 'male' && gender !== 'female') {
                    res.status(400).json({
                        error: {
                            message: 'Gender must be either "male" or "female"',
                            status: 400,
                        },
                    });
                    return;
                }
                criteria.gender = gender;
            }

            // Fetch random images with specified criteria
            const images = await imageDataService.getRandomImages(imageCount, criteria);

            if (!images) {
                res.status(404).json({
                    error: {
                        message:
                            'Not enough images with all criteria met were found to fulfill request',
                        status: 404,
                    },
                });
                return;
            }

            const imagesWithUrls = await Promise.all(
                images.map(async (image) => {
                    let signedUrl = image.imageUrl; // Default to filename if signing fails
                    try {
                        signedUrl = await storageService.getSignedUrl(image.imageUrl);
                    } catch (error) {
                        console.error(
                            `Failed to generate signed URL for image ${image.imageId}:`,
                            error,
                        );
                        // Continue with the original filename/path
                    }
                    return {
                        ...image,
                        imageUrl: signedUrl,
                    };
                }),
            );

            res.json({
                success: true,
                images: imagesWithUrls,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error fetching image pairs:', error);

            res.status(500).json({
                error: {
                    message: 'Failed to fetch image pairs',
                    status: 500,
                },
            });
        }
    }),
);

export default router;
