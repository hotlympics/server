import { storage } from '../config/firebase-admin.js';
import path from 'path';

const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'hotlympics-images';
const bucket = storage.bucket(bucketName);

export const storageService = {
    async uploadImage(
        file: Express.Multer.File,
        imageId: string,
    ): Promise<{ imageId: string; imageUrl: string }> {
        const fileExtension = path.extname(file.originalname);
        const fileName = `${imageId}${fileExtension}`;
        const fileRef = bucket.file(fileName);

        const stream = fileRef.createWriteStream({
            resumable: false,
            metadata: {
                contentType: file.mimetype,
                cacheControl: 'public, max-age=31536000',
            },
        });

        return new Promise((resolve, reject) => {
            stream.on('error', (err) => {
                reject(err);
            });

            stream.on('finish', () => {
                // Store just the filename, not the full URL
                // We'll serve images through our own endpoint
                resolve({ imageId: imageId, imageUrl: fileName });
            });

            stream.end(file.buffer);
        });
    },

    async deleteImage(imageUrl: string): Promise<void> {
        // imageUrl is now just the filename
        const fileName = imageUrl;
        if (!fileName) {
            throw new Error('Invalid image URL');
        }

        await bucket.file(fileName).delete();
    },

    async findImageByIdPrefix(imageId: string): Promise<string | null> {
        const [files] = await bucket.getFiles({ prefix: imageId });

        if (files.length === 0) {
            return null;
        }

        // Return the first matching file name
        return files[0].name;
    },

    async getSignedUrl(fileName: string): Promise<string> {
        const file = bucket.file(fileName);

        // Generate a signed URL that expires in 1 hour
        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000, // 1 hour from now
        });

        return url;
    },

    async getSignedUploadUrl(fileName: string): Promise<{
        uploadUrl: string;
        downloadUrl: string;
    }> {
        const file = bucket.file(fileName);

        // Generate a signed URL for upload without strict content type
        const [uploadUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        });

        // Also generate a signed download URL
        const [downloadUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });

        return { uploadUrl, downloadUrl };
    },

    async verifyImageExists(fileName: string): Promise<boolean> {
        try {
            const file = bucket.file(fileName);
            const [exists] = await file.exists();
            return exists;
        } catch (error) {
            console.error('Error checking if file exists:', error);
            return false;
        }
    },
};
