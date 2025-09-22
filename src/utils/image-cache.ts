import { ImageCacheEntry } from '../types/image-cache-entry.js';

const MAX_IMAGES = 100_000;

/**
 * In-memory cache for storing and managing image data documents.
 * Maintains a sorted collection by score with a fixed capacity of 100,000 entries.
 * When a new entry is added, it's inserted in the correct position by score,
 * and the lowest-scoring entry is evicted if at capacity.
 */
export class ImageCache {
    private entries: ImageCacheEntry[] = []; // Sorted by score (descending)
    private maxSize = MAX_IMAGES;

    constructor() {
        this.entries = [];
    }

    /**
     * Add or update an entry in the cache.
     * The entry is inserted at the correct position based on its score.
     * If at capacity, the lowest-scoring entry is evicted.
     */
    add(entry: ImageCacheEntry): void {
        // Binary search to find insertion point
        const insertIndex = this.binarySearch(entry.score);

        // Insert at correct position
        this.entries.splice(insertIndex, 0, entry);

        // Evict lowest score if over capacity
        if (this.entries.length > this.maxSize) {
            this.entries.pop(); // Remove last (lowest score)
        }
    }

    /**
     * Get the current size of the cache
     */
    size(): number {
        return this.entries.length;
    }

    /**
     * Binary search to find insertion index for a given score
     * Returns the index where the entry should be inserted to maintain descending order
     */
    private binarySearch(score: number): number {
        let left = 0;
        let right = this.entries.length;

        while (left < right) {
            const mid = Math.floor((left + right) / 2);
            if (this.entries[mid].score > score) {
                left = mid + 1;
            } else {
                right = mid;
            }
        }

        return left;
    }
}
