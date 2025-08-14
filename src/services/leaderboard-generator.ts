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

    try {
        logger.info('Starting leaderboard generation cycle');

        // Generate each leaderboard
        for (const config of LEADERBOARD_CONFIG.leaderboards) {
            try {
                const leaderboard = await leaderboardService.generateLeaderboard(config);
                await leaderboardService.saveLeaderboard(config.key, leaderboard);
                successCount++;
                logger.info(`Successfully generated leaderboard: ${config.key}`);
            } catch (error) {
                errorCount++;
                lastError = error instanceof Error ? error.message : 'Unknown error';
                logger.error(`Failed to generate leaderboard ${config.key}:`, error);
                // Continue with other leaderboards even if one fails
            }
        }

        // Update global metadata
        const globalMetadata: GlobalMetadata = {
            lastGeneratedAt: new Date().toISOString(),
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
        logger.info(
            `Leaderboard generation completed in ${duration}ms. Success: ${successCount}, Errors: ${errorCount}`,
        );
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

        logger.info('Leaderboards are up to date');
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
    logger.info('Forcing leaderboard regeneration');
    await generateAllLeaderboards();
}

// Export functional object
export const leaderboardGenerator = {
    generateAllLeaderboards,
    regenerateIfNeeded,
    forceRegeneration,
};
