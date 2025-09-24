import multer from 'multer';
import { Request } from 'express';
import { UPLOAD_CONFIG } from '../config/constants.js';

const storage = multer.memoryStorage();

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = UPLOAD_CONFIG.ALLOWED_MIME_TYPES as readonly string[];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
};

export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: UPLOAD_CONFIG.MAX_FILE_SIZE_BYTES,
    },
});
