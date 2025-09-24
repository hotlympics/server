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

    addMultiple(entries: ImageCacheEntry[]): void {
        for (const entry of entries) {
            this.add(entry);
        }
    }

    size(): number {
        return this.entries.length;
    }

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
