import { Firestore } from 'firebase-admin/firestore';
import { ImageCache } from '../utils/image-cache.js';
import { db } from '../config/firebase-admin.js';
import { ImageData } from '../types/image-data.js';

/**
 * Service for managing cached image data in memory.
 * Maintains a synchronized copy of all image-data documents from Firestore.
 */
export class ImageCacheService {
    private static instance: ImageCacheService | null = null;
    private db: Firestore;
    private cache: ImageCache;
    private isInitialized: boolean = false;

    private constructor() {
        this.db = db;
        this.cache = new ImageCache();
        // Suppress unused warnings for skeleton implementation
        void this.db;
        void this.cache;
        void this.isInitialized;
    }

    /**
     * Get singleton instance of ImageCacheService
     */
    static getInstance(): ImageCacheService {
        if (!ImageCacheService.instance) {
            ImageCacheService.instance = new ImageCacheService();
        }
        return ImageCacheService.instance;
    }

    /**
     * Initialize the cache by loading all image data from Firestore
     */
    async initialize(): Promise<void> {
        // TODO: Implement initialization logic
        // - Load all image-data documents from Firestore
        // - Populate the collection
        // - Set up real-time listeners or polling
        await this.loadImageDataFromFirestore();
        this.isInitialized = true;
    }

    /**
     * Load up to 100,000 image-data documents from Firestore.
     * Uses random sampling to select documents without duplicates.
     */
    private async loadImageDataFromFirestore(): Promise<void> {
        const MAX_DOCS = 100_000;
        const BATCH_SIZE = 500; // Firestore has a limit of 500 docs per query

        try {
            console.log(
                `Starting to load up to ${MAX_DOCS} image-data documents from Firestore...`,
            );

            const imageDataCollection = this.db.collection('image-data');
            const loadedDocIds = new Set<string>();
            const allDocuments: ImageData[] = [];

            // First, get the total count of documents
            const countSnapshot = await imageDataCollection.count().get();
            const totalDocs = countSnapshot.data().count;
            console.log(`Total documents in collection: ${totalDocs}`);

            if (totalDocs === 0) {
                console.log('No documents found in image-data collection');
                return;
            }

            // If total docs is less than or equal to MAX_DOCS, just load them all
            if (totalDocs <= MAX_DOCS) {
                let lastDoc = null;

                while (allDocuments.length < totalDocs) {
                    let query = imageDataCollection.orderBy('imageId').limit(BATCH_SIZE);

                    if (lastDoc) {
                        query = query.startAfter(lastDoc);
                    }

                    const snapshot = await query.get();

                    if (snapshot.empty) {
                        break;
                    }

                    snapshot.forEach((doc) => {
                        const data = doc.data() as ImageData;
                        if (!loadedDocIds.has(data.imageId)) {
                            allDocuments.push(data);
                            loadedDocIds.add(data.imageId);
                        }
                    });

                    lastDoc = snapshot.docs[snapshot.docs.length - 1];

                    if (allDocuments.length % 10000 === 0) {
                        console.log(`Loaded ${allDocuments.length} documents so far...`);
                    }
                }
            } else {
                // If we have more docs than MAX_DOCS, we need to randomly sample
                // For now, we'll just take the first MAX_DOCS ordered by randomSeed
                let lastDoc = null;

                while (allDocuments.length < MAX_DOCS) {
                    const remaining = MAX_DOCS - allDocuments.length;
                    const batchLimit = Math.min(BATCH_SIZE, remaining);

                    let query = imageDataCollection.orderBy('randomSeed').limit(batchLimit);

                    if (lastDoc) {
                        query = query.startAfter(lastDoc);
                    }

                    const snapshot = await query.get();

                    if (snapshot.empty) {
                        break;
                    }

                    snapshot.forEach((doc) => {
                        const data = doc.data() as ImageData;
                        if (!loadedDocIds.has(data.imageId)) {
                            allDocuments.push(data);
                            loadedDocIds.add(data.imageId);
                        }
                    });

                    lastDoc = snapshot.docs[snapshot.docs.length - 1];

                    if (allDocuments.length % 10000 === 0) {
                        console.log(`Loaded ${allDocuments.length} documents so far...`);
                    }
                }
            }

            console.log(`Successfully loaded ${allDocuments.length} unique image-data documents`);

            // TODO: Process the loaded documents (e.g., add to cache)
            // For now, we're just loading them and doing nothing
        } catch (error) {
            console.error('Error loading image-data documents from Firestore:', error);
            throw error;
        }
    }
}
