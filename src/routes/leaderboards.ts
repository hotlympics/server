// Leaderboard API endpoints
// HTTP routes for accessing leaderboards

import { Router, Request, Response, NextFunction } from 'express';
import { leaderboardService } from '../services/leaderboard-service.js';
import { leaderboardGenerator } from '../services/leaderboard-generator.js';
import { LEADERBOARD_CONFIG } from '../config/leaderboard-config.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * GET /leaderboards/:key
 * Get a specific leaderboard by key
 */
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get('/:key', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { key } = req.params;

        // Validate key exists in config
        const validKeys = LEADERBOARD_CONFIG.leaderboards.map((lb) => lb.key);
        if (!validKeys.includes(key)) {
            res.status(404).json({
                error: 'Leaderboard not found',
                availableKeys: validKeys,
            });
            return;
        }

        // Check if regeneration is needed (cold-start check)
        await leaderboardGenerator.regenerateIfNeeded();

        // Get leaderboard
        const leaderboard = await leaderboardService.getLeaderboard(key);

        if (!leaderboard) {
            res.status(404).json({
                error: 'Leaderboard data not found',
                message: 'Leaderboard may not have been generated yet',
            });
            return;
        }

        res.json(leaderboard);
    } catch (error) {
        logger.error(`Error fetching leaderboard ${req.params.key}:`, error);
        next(error);
    }
});

/**
 * GET /leaderboards
 * Get list of available leaderboards and their metadata
 */
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const globalMetadata = await leaderboardService.getGlobalMetadata();
        const availableLeaderboards = LEADERBOARD_CONFIG.leaderboards.map((lb) => ({
            key: lb.key,
            type: lb.type,
            criteria: lb.criteria,
            limit: lb.limit,
        }));

        res.json({
            leaderboards: availableLeaderboards,
            metadata: globalMetadata,
            config: {
                version: LEADERBOARD_CONFIG.version,
                regenerationIntervalMs: LEADERBOARD_CONFIG.regenerationIntervalMs,
            },
        });
    } catch (error) {
        logger.error('Error fetching leaderboards list:', error);
        next(error);
    }
});

/**
 * POST /leaderboards/regenerate
 * Force regeneration of all leaderboards
 * TODO: Add authentication middleware for admin access
 */
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post('/regenerate', async (_req: Request, res: Response): Promise<void> => {
    try {
        logger.info('Manual leaderboard regeneration requested');

        await leaderboardGenerator.forceRegeneration();

        res.json({
            success: true,
            message: 'Leaderboards regenerated successfully',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('Error during manual regeneration:', error);
        res.status(500).json({
            error: 'Failed to regenerate leaderboards',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

export { router as leaderboardsRouter };
