// Leaderboard generation orchestration
// Handles the regeneration of all leaderboards and metadata updates

import { leaderboardService } from './leaderboard-service.js';
import { LEADERBOARD_CONFIG, LEADERBOARD_DATA_VERSION } from '../config/leaderboard-config.js';
import { GlobalMetadata } from '../models/leaderboard.js';
import { logger } from '../utils/logger.js';

/**
 * Generate all leaderboards based on configuration
 */
async function generateAllLeaderboards(): Promise<void> {
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;
    let lastError: string | undefined;
    const results: string[] = [];

    try {
        // Generate each leaderboard
        for (const config of LEADERBOARD_CONFIG.leaderboards) {
            try {
                const leaderboard = await leaderboardService.generateLeaderboard(config);
                await leaderboardService.saveLeaderboard(config.key, leaderboard);
                successCount++;
                results.push(`${config.key}:${leaderboard.entries.length}`);
            } catch (error) {
                errorCount++;
                lastError = error instanceof Error ? error.message : 'Unknown error';
                logger.error(`Failed to generate leaderboard ${config.key}:`, error);
                results.push(`${config.key}:ERROR`);
                // Continue with other leaderboards even if one fails
            }
        }

        // Get current global metadata to preserve updateCount
        const currentGlobalMeta = await leaderboardService.getGlobalMetadata();
        const currentUpdateCount = currentGlobalMeta?.updateCount || 0;

        // Update global metadata
        const globalMetadata: GlobalMetadata = {
            lastGeneratedAt: new Date().toISOString(),
            updateCount: currentUpdateCount + 1,
            configVersion: LEADERBOARD_CONFIG.version,
            leaderboardVersion: LEADERBOARD_DATA_VERSION,
            leaderboardCount: LEADERBOARD_CONFIG.leaderboards.length,
            generatorInfo: {
                lastRunStatus: errorCount === 0 ? 'success' : 'error',
                leaderboardsProcessed: successCount,
                ...(lastError && { error: lastError }),
            },
        };

        await leaderboardService.updateGlobalMetadata(globalMetadata);

        const duration = Date.now() - startTime;
        const status = errorCount === 0 ? '✅' : `⚠️ ${errorCount} errors`;

        logger.info(`Leaderboards regenerated ${status} (${duration}ms): ${results.join(', ')}`);
    } catch (error) {
        logger.error('Fatal error during leaderboard generation:', error);
        throw error;
    }
}

/**
 * Check if regeneration is needed and run if so
 */
async function regenerateIfNeeded(): Promise<boolean> {
    try {
        const needsRegen = await leaderboardService.needsRegeneration();

        if (needsRegen) {
            await generateAllLeaderboards();
            return true;
        }

        return false;
    } catch (error) {
        logger.error('Error during regeneration check:', error);
        throw error;
    }
}

/**
 * Force regeneration of all leaderboards
 */
async function forceRegeneration(): Promise<void> {
    await generateAllLeaderboards();
}

// Export functional object
export const leaderboardGenerator = {
    generateAllLeaderboards,
    regenerateIfNeeded,
    forceRegeneration,
};
