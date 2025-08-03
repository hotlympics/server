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

    async getImageStream(fileName: string): Promise<NodeJS.ReadableStream> {
        const file = bucket.file(fileName);
        const [exists] = await file.exists();

        if (!exists) {
            throw new Error('Image not found');
        }

        return file.createReadStream();
    },

    async getImageMetadata(fileName: string): Promise<{ contentType: string; size: number }> {
        const file = bucket.file(fileName);
        const [metadata] = await file.getMetadata();

        return {
            contentType: metadata.contentType || 'image/jpeg',
            size: parseInt(metadata.size as string, 10),
        };
    },

    async findImageByIdPrefix(imageId: string): Promise<string | null> {
        const [files] = await bucket.getFiles({ prefix: imageId });

        if (files.length === 0) {
            return null;
        }

        // Return the first matching file name
        return files[0].name;
    },
};
