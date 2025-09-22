// Core leaderboard service logic
// Contains the main business logic for leaderboard operations

import { firestore } from '../config/firebase-admin.js';
import { storageService } from './storage-service.js';
import {
    LEADERBOARD_CONFIG,
    LEADERBOARD_COLLECTIONS,
    METADATA_DOCUMENT_ID,
    LeaderboardConfig,
    LEADERBOARD_DATA_VERSION,
} from '../config/leaderboard-config.js';
import {
    LeaderboardDocument,
    LeaderboardEntry,
    GlobalMetadata,
    LeaderboardMetadata,
} from '../types/leaderboard.js';
import { GlickoState } from '../types/image-data.js';
import { Timestamp, Query, DocumentData } from '@google-cloud/firestore';
import { logger } from '../utils/logger.js';

// Interface for Firebase document data (differs from ImageData due to Firestore serialization)
interface FirestoreImageData {
    imageId: string;
    userId: string;
    imageUrl: string; // filename, not full URL
    gender: 'male' | 'female';
    dateOfBirth: Timestamp;
    battles: number;
    wins: number;
    losses: number;
    draws: number;
    glicko: GlickoState;
    inPool: boolean;
}

/**
 * Get a specific leaderboard by key
 * Single Firestore read operation
 */
async function getLeaderboard(key: string): Promise<LeaderboardDocument | null> {
    try {
        const doc = await firestore.collection(LEADERBOARD_COLLECTIONS.LEADERBOARDS).doc(key).get();

        if (!doc.exists) {
            logger.warn(`Leaderboard not found: ${key}`);
            return null;
        }

        return doc.data() as LeaderboardDocument;
    } catch (error) {
        logger.error(`Error fetching leaderboard ${key}:`, error);
        throw error;
    }
}

/**
 * Get global metadata about all leaderboards
 */
async function getGlobalMetadata(): Promise<GlobalMetadata | null> {
    try {
        const doc = await firestore
            .collection(LEADERBOARD_COLLECTIONS.METADATA)
            .doc(METADATA_DOCUMENT_ID)
            .get();

        if (!doc.exists) {
            return null;
        }

        return doc.data() as GlobalMetadata;
    } catch (error) {
        logger.error('Error fetching global metadata:', error);
        throw error;
    }
}

/**
 * Check if leaderboards need regeneration
 */
async function needsRegeneration(): Promise<boolean> {
    try {
        const metadata = await getGlobalMetadata();

        if (!metadata) {
            logger.info('No metadata found, regeneration needed');
            return true;
        }

        const now = Date.now();
        const lastGenerated = new Date(metadata.lastGeneratedAt).getTime();
        const timeSinceLastRegen = now - lastGenerated;

        if (timeSinceLastRegen > LEADERBOARD_CONFIG.regenerationIntervalMs) {
            logger.info(`Leaderboards stale (${timeSinceLastRegen}ms), regeneration needed`);
            return true;
        }

        if (metadata.configVersion !== LEADERBOARD_CONFIG.version) {
            logger.info('Config version changed, regeneration needed');
            return true;
        }

        if (metadata.leaderboardVersion !== LEADERBOARD_DATA_VERSION) {
            logger.info('Leaderboard data version changed, regeneration needed');
            return true;
        }

        return false;
    } catch (error) {
        logger.error('Error checking regeneration status:', error);
        return true; // Regenerate on error to be safe
    }
}

/**
 * Generate a single leaderboard based on config
 */
async function generateLeaderboard(config: LeaderboardConfig): Promise<LeaderboardDocument> {
    try {
        // Get existing leaderboard metadata if it exists
        const existingLeaderboard = await getLeaderboard(config.key);

        // Build Firestore query dynamically from criteria
        let query: Query<DocumentData> = firestore.collection('image-data');

        // Apply all criteria filters dynamically
        for (const [field, value] of Object.entries(config.criteria)) {
            query = query.where(field, '==', value);
        }

        // Add ordering based on type
        if (config.type === 'top') {
            query = query.orderBy('glicko.rating', 'desc');
        } else {
            query = query.orderBy('glicko.rating', 'asc');
        }

        // Apply limit
        query = query.limit(config.limit);

        // Execute query
        const snapshot = await query.get();

        if (snapshot.empty) {
            // Still create leaderboard with empty entries for consistency
            return createEmptyLeaderboard(config, existingLeaderboard?.metadata);
        }

        // Process results and generate signed URLs
        const entries: LeaderboardEntry[] = [];
        const urlPromises: Promise<string>[] = [];

        // Collect all filename promises first
        for (const doc of snapshot.docs) {
            const data = doc.data() as Partial<FirestoreImageData>;
            urlPromises.push(storageService.getSignedUrl(data.imageUrl || ''));
        }

        // Wait for all URLs to be generated
        const signedUrls = await Promise.all(urlPromises);

        // Create entries with signed URLs
        for (let i = 0; i < snapshot.docs.length; i++) {
            const doc = snapshot.docs[i];
            const data = doc.data() as Partial<FirestoreImageData>;

            entries.push({
                imageId: doc.id,
                imageUrl: signedUrls[i],
                userId: data.userId || '',
                rating: data.glicko?.rating || 0,
                gender: data.gender || 'male',
                battles: data.battles || 0,
                wins: data.wins || 0,
                losses: data.losses || 0,
                draws: data.draws || 0,
                dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toDate().toISOString() : '',
            });
        }

        // Calculate metadata with existing metadata for version tracking
        const metadata = calculateMetadata(config, entries, existingLeaderboard?.metadata);

        return {
            entries,
            metadata,
        };
    } catch (error) {
        logger.error(`Error generating leaderboard ${config.key}:`, error);
        throw error;
    }
}

/**
 * Save leaderboard to Firestore
 */
async function saveLeaderboard(key: string, leaderboard: LeaderboardDocument): Promise<void> {
    try {
        await firestore.collection(LEADERBOARD_COLLECTIONS.LEADERBOARDS).doc(key).set(leaderboard);
    } catch (error) {
        logger.error(`Error saving leaderboard ${key}:`, error);
        throw error;
    }
}

/**
 * Update global metadata
 */
async function updateGlobalMetadata(metadata: GlobalMetadata): Promise<void> {
    try {
        await firestore
            .collection(LEADERBOARD_COLLECTIONS.METADATA)
            .doc(METADATA_DOCUMENT_ID)
            .set(metadata);
    } catch (error) {
        logger.error('Error updating global metadata:', error);
        throw error;
    }
}

/**
 * Create an empty leaderboard when no data is found
 */
function createEmptyLeaderboard(
    config: LeaderboardConfig,
    existingMetadata?: LeaderboardMetadata,
): LeaderboardDocument {
    const now = new Date().toISOString();

    return {
        entries: [],
        metadata: {
            generatedAt: now,
            updateCount: existingMetadata ? existingMetadata.updateCount + 1 : 1,
            firstGeneratedAt: existingMetadata?.firstGeneratedAt || now,
            actualEntryCount: 0,
            averageRating: 0,
            ratingRange: {
                highest: 0,
                lowest: 0,
            },
            dataQuality: {
                allImagesValid: true,
                missingFields: [],
                errorCount: 0,
            },
            configVersion: LEADERBOARD_CONFIG.version,
            configKey: config.key,
        },
    };
}

/**
 * Calculate metadata for a leaderboard
 */
function calculateMetadata(
    config: LeaderboardConfig,
    entries: LeaderboardEntry[],
    existingMetadata?: LeaderboardMetadata,
): LeaderboardMetadata {
    const ratings = entries.map((e) => e.rating);
    const averageRating =
        ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    const now = new Date().toISOString();

    return {
        generatedAt: now,
        updateCount: existingMetadata ? existingMetadata.updateCount + 1 : 1,
        firstGeneratedAt: existingMetadata?.firstGeneratedAt || now,
        actualEntryCount: entries.length,
        averageRating,
        ratingRange: {
            highest: ratings.length > 0 ? Math.max(...ratings) : 0,
            lowest: ratings.length > 0 ? Math.min(...ratings) : 0,
        },
        dataQuality: {
            allImagesValid: true,
            missingFields: [],
            errorCount: 0,
        },
        configVersion: LEADERBOARD_CONFIG.version,
        configKey: config.key,
    };
}

// Export functional object
export const leaderboardService = {
    getLeaderboard,
    getGlobalMetadata,
    needsRegeneration,
    generateLeaderboard,
    saveLeaderboard,
    updateGlobalMetadata,
};
