import { Router, Request, Response, NextFunction } from 'express';
import { upload } from '../middleware/upload-middleware.js';
import { storageService } from '../services/storage-service.js';
import {
    firebaseAuthMiddleware,
    type AuthRequest,
} from '../middleware/firebase-auth-middleware.js';
import { imageDataService } from '../services/image-data-service.js';
import { v4 as uuidv4 } from 'uuid';
import { firestore } from '../config/firestore.js';
import { UserService } from '../services/user-service.js';

const router = Router();

const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

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
            const user = await UserService.getUserById(req.user.id);
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

            // Generate a unique imageId
            const imageId = uuidv4();

            // Upload to GCS with the imageId
            const { imageUrl: fileName } = await storageService.uploadImage(req.file, imageId);

            // Create image data record in Firestore
            // Store the filename in Firestore (not the full URL)
            await imageDataService.createImageData(imageId, req.user.id, fileName);

            // Add image ID to user's uploadedImageIds array
            await UserService.addUploadedImageId(req.user.id, imageId);

            const responseUrl = `/images/serve/${fileName}`;

            res.json({
                success: true,
                imageId: imageId,
                imageUrl: responseUrl,
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
            const user = await UserService.getUserById(req.user.id);
            if (!user) {
                res.status(404).json({
                    error: {
                        message: 'User not found',
                        status: 404,
                    },
                });
                return;
            }

            // Map image IDs directly to URLs
            // Since we don't have upload dates without image-stats, we'll return them in the order they appear in the array
            // (which should be in upload order since we use arrayUnion)
            const userImages = user.uploadedImageIds.map((imageId) => {
                // We need to check which file exists in storage since we don't know the extension
                // For now, we'll construct the URL pattern that the serve endpoint will handle
                return {
                    id: imageId,
                    url: `/images/serve/${imageId}`,
                };
            });

            // Return in reverse order (newest first) based on array position
            res.json(userImages.reverse());
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
    '/serve/:fileName',
    asyncHandler(async (req: Request, res: Response) => {
        try {
            let { fileName } = req.params;

            // Check if fileName looks like an imageId (UUID without extension)
            const isImageId =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileName);

            if (isImageId) {
                // Try to find the actual filename with extension
                const actualFileName = await storageService.findImageByIdPrefix(fileName);
                if (!actualFileName) {
                    res.status(404).json({
                        error: {
                            message: 'Image not found',
                            status: 404,
                        },
                    });
                    return;
                }
                fileName = actualFileName;
            }

            // Get image metadata first
            const metadata = await storageService.getImageMetadata(fileName);

            // Set proper headers
            res.setHeader('Content-Type', metadata.contentType);
            res.setHeader('Content-Length', metadata.size.toString());
            res.setHeader('Cache-Control', 'no-store'); // Don't cache at all
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // Allow cross-origin image loading

            // Stream the image
            const stream = await storageService.getImageStream(fileName);

            stream.on('error', (err) => {
                console.error('Stream error:', err);
                if (!res.headersSent) {
                    res.status(500).json({
                        error: { message: 'Failed to stream image', status: 500 },
                    });
                }
            });

            stream.pipe(res);
        } catch (error) {
            // Return 404 for missing images
            res.status(404).json({
                error: {
                    message: 'Image not found',
                    status: 404,
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
            const user = await UserService.getUserById(req.user.id);
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

            // Delete from GCS
            await storageService.deleteImage(fileNameToDelete);

            // Delete the image-data document completely
            await firestore.collection('image-data').doc(imageId).delete();

            // Remove image ID from user's uploadedImageIds array
            await UserService.removeUploadedImageId(req.user.id, imageId);

            // Also remove from poolImageIds if it was in the pool
            if (user.poolImageIds.includes(imageId)) {
                await UserService.removePoolImageId(req.user.id, imageId);
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

export default router;
