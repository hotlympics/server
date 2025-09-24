import { Firestore } from 'firebase-admin/firestore';
import { ImageCache } from '../utils/image-cache.js';
import { db } from '../config/firebase-admin.js';
import { ImageData } from '../types/image-data.js';

export class ImageCacheService {
    private static instance: ImageCacheService | null = null;
    private db: Firestore;
    private cache: ImageCache;

    private constructor() {
        this.db = db;
        this.cache = new ImageCache();
    }

    static getInstance(): ImageCacheService {
        if (!ImageCacheService.instance) {
            ImageCacheService.instance = new ImageCacheService();
        }
        return ImageCacheService.instance;
    }

    private async loadImageDataFromFirestore(): Promise<void> {
        ;
    }
}
