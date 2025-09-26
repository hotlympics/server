import { ImageData } from '@/types/image-data.js';
import { ImageCacheEntry } from '../types/image-cache-entry.js';

const MAX_IMAGES = 100_000;

const computeScore = (imageData: ImageData): number => {
    let score = Math.max(100 - imageData.battles);

    if (score <= 0) {
        score = 1;
    }
    return score;
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

    getWeightedRandomSample(
        count: number,
        criteriaFunction: (imageData: ImageData) => boolean,
    ): ImageData[] | null {
        let totalWeight = 0;
        for (const entry of this.entries) {
            if (criteriaFunction(entry.imageData)) {
                totalWeight += entry.score;
            }
        }

        const selectedUserIds = new Set<string>();
        const selectedImages: ImageData[] = [];

        while (selectedImages.length < count) {
            let imageSelected = false;
            const rand = Math.random() * totalWeight;
            let cumWeight = 0;
            for (const entry of this.entries) {
                if (!criteriaFunction(entry.imageData)) {
                    continue;
                }
                if (selectedUserIds.has(entry.imageData.userId)) {
                    continue;
                }
                cumWeight += entry.score;
                if (cumWeight >= rand) {
                    selectedImages.push(entry.imageData);
                    selectedUserIds.add(entry.imageData.userId);
                    totalWeight -= entry.score;
                    imageSelected = true;
                    break;
                }
            }
            if (!imageSelected) {
                console.error('Failed to select an image in this iteration');
                break;
            }
        }

        return selectedImages;
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
