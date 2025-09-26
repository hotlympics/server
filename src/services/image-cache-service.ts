import { Firestore } from 'firebase-admin/firestore';
import { ImageCache } from '../utils/image-cache.js';
import { db } from '../config/firebase-admin.js';
import { ImageData } from '../types/image-data.js';
import { metadataService } from './metadata-service.js';
import { logger } from '../utils/logger.js';
import { CACHE_CONFIG } from '../config/constants.js';

export class ImageCacheService {
    private static instance: ImageCacheService | null = null;
    private db: Firestore;
    private cache: ImageCache;
    private refreshInterval: NodeJS.Timeout | null = null;
    private isLoading: boolean = false;

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

    async initialize(): Promise<void> {
        logger.info('Initializing ImageCacheService...');

        await this.refresh();

        // Set up hourly refresh
        this.refreshInterval = setInterval(() => {
            this.refresh().catch((error) => {
                logger.error('Failed to refresh cache on interval:', error);
            });
        }, CACHE_CONFIG.IMAGE_CACHE_REFRESH_INTERVAL_MS);

        logger.info('ImageCacheService initialized with hourly refresh');
    }

    async refresh(): Promise<void> {
        if (this.isLoading) {
            logger.warn('Cache refresh already in progress, skipping...');
            return;
        }

        this.isLoading = true;
        try {
            await this.loadImageDataFromFirestore();
        } finally {
            this.isLoading = false;
        }
    }

    getRandomImages(
        count: number,
        criteria: {
            gender?: 'male' | 'female';
        },
    ): ImageData[] | null {
        if (this.cache.size() < count) {
            logger.warn(
                `Cache size (${this.cache.size()}) is smaller than requested count (${count}), cannot fulfill request`,
            );
            return null;
        }

        const criteriaFunction = (image: ImageData): boolean => {
            if (criteria.gender && criteria.gender !== image.gender) {
                return false;
            }
            return true;
        };

        const images = this.cache.getWeightedRandomSample(count, criteriaFunction);

        if (!images || images.length < count) {
            logger.warn(
                `Could not find ${count} images matching criteria. Found ${images?.length || 0} images.`,
            );
            return null;
        }

        return images;
    }

    stop(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            logger.info('ImageCacheService refresh interval stopped');
        }
    }

    getCacheSize(): number {
        return this.cache.size();
    }

    private async loadImageDataFromFirestore(): Promise<void> {
        try {
            const metadata = await metadataService.getSystemMetadata();
            const totalImagesInPool = metadata.imagesInPool;
            const imagesToFetch = Math.min(totalImagesInPool, CACHE_CONFIG.IMAGE_CACHE_MAX_SIZE);

            const nextCache = new ImageCache();

            let fetchedCount = 0;
            let lastDoc = null;

            const randomStart = Math.random();
            let hasWrapped = false;

            while (fetchedCount < imagesToFetch) {
                let query = this.db.collection('image-data').where('inPool', '==', true);

                if (!hasWrapped) {
                    query = query.where('randomSeed', '>=', randomStart);
                } else {
                    query = query.where('randomSeed', '<', randomStart);
                }

                query = query
                    .orderBy('randomSeed')
                    .limit(
                        Math.min(CACHE_CONFIG.IMAGE_CACHE_BATCH_SIZE, imagesToFetch - fetchedCount),
                    );

                if (lastDoc) {
                    query = query.startAfter(lastDoc);
                }

                const snapshot = await query.get();

                if (snapshot.empty) {
                    if (!hasWrapped) {
                        hasWrapped = true;
                        lastDoc = null;
                        continue;
                    } else {
                        logger.info(`No more documents found. Fetched ${fetchedCount} total.`);
                        break;
                    }
                }

                const batchEntries: ImageData[] = [];
                snapshot.forEach((doc) => {
                    const imageData = doc.data() as ImageData;
                    batchEntries.push(imageData);
                });

                nextCache.addMultiple(batchEntries);

                fetchedCount += snapshot.size;
                lastDoc = snapshot.docs[snapshot.docs.length - 1];

                if (fetchedCount % CACHE_CONFIG.IMAGE_CACHE_LOG_INTERVAL === 0) {
                    logger.info(
                        `Cache load progress: ${fetchedCount}/${imagesToFetch} images fetched`,
                    );
                }
            }

            this.cache = nextCache;

            logger.info(`Cache load complete: ${this.cache.size()} images loaded into cache`);
        } catch (error) {
            logger.error('Error loading image data into cache:', error);
            throw error;
        }
    }
}
