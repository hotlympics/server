import { Storage } from '@google-cloud/storage';
import path from 'path';

const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const bucketName = process.env.GCS_BUCKET_NAME || 'hotlympics-images';

export const storageService = {
    async uploadImage(
        file: Express.Multer.File,
        imageId: string,
    ): Promise<{ imageId: string; imageUrl: string }> {
        const bucket = storage.bucket(bucketName);

        const fileExtension = path.extname(file.originalname);
        const fileName = `${imageId}${fileExtension}`;
        const blob = bucket.file(fileName);

        const blobStream = blob.createWriteStream({
            resumable: false,
            metadata: {
                contentType: file.mimetype,
                cacheControl: 'public, max-age=31536000',
            },
        });

        return new Promise((resolve, reject) => {
            blobStream.on('error', (err) => {
                reject(err);
            });

            blobStream.on('finish', () => {
                // Store just the filename, not the full URL
                // We'll serve images through our own endpoint
                resolve({ imageId: imageId, imageUrl: fileName });
            });

            blobStream.end(file.buffer);
        });
    },

    async deleteImage(imageUrl: string): Promise<void> {
        // imageUrl is now just the filename
        const fileName = imageUrl;
        if (!fileName) {
            throw new Error('Invalid image URL');
        }

        const bucket = storage.bucket(bucketName);
        await bucket.file(fileName).delete();
    },

    async getImageStream(fileName: string): Promise<NodeJS.ReadableStream> {
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(fileName);
        const [exists] = await file.exists();

        if (!exists) {
            throw new Error('Image not found');
        }

        return file.createReadStream();
    },

    async getImageMetadata(fileName: string): Promise<{ contentType: string; size: number }> {
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(fileName);
        const [metadata] = await file.getMetadata();

        return {
            contentType: metadata.contentType || 'image/jpeg',
            size: parseInt(metadata.size as string, 10),
        };
    },

    async findImageByIdPrefix(imageId: string): Promise<string | null> {
        const bucket = storage.bucket(bucketName);
        const [files] = await bucket.getFiles({ prefix: imageId });

        if (files.length === 0) {
            return null;
        }

        // Return the first matching file name
        return files[0].name;
    },
};
