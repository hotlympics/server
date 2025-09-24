import { ImageData } from '@/types/image-data.js';
import { ImageCacheEntry } from '../types/image-cache-entry.js';

const MAX_IMAGES = 100_000;

const computeScore = (imageData: ImageData): number => {
    return Math.max(100 - imageData.battles, 1);
};

export class ImageCache {
    private entries: ImageCacheEntry[] = []; // Sorted by score (descending)
    private maxSize = MAX_IMAGES;

    constructor() {
        this.entries = [];
    }

    add(imageData: ImageData): void {
        const cacheEntry: ImageCacheEntry = {
            imageData: imageData,
            score: computeScore(imageData),
        };

        // Binary search to find insertion point
        const insertIndex = this.binarySearch(cacheEntry.score);

        // Insert at correct position
        this.entries.splice(insertIndex, 0, cacheEntry);

        // Evict lowest score if over capacity
        if (this.entries.length > this.maxSize) {
            this.entries.pop(); // Remove last (lowest score)
        }
    }

    addMultiple(entries: ImageData[]): void {
        for (const entry of entries) {
            this.add(entry);
        }
    }

    size(): number {
        return this.entries.length;
    }

    clear(): void {
        this.entries = [];
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
