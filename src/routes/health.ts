import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: {
            seconds: Math.floor(uptime),
            formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
        },
        memory: {
            rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
        },
        version: process.env.npm_package_version || '0.0.0',
        environment: process.env.NODE_ENV || 'development',
    });
});

router.get('/memory', (_req: Request, res: Response) => {
    const memUsage = process.memoryUsage();
    const totalMemory = 512 * 1024 * 1024; // Cloud Run has 512Mi

    res.json({
        allocated: {
            mb: Math.round(memUsage.heapTotal / 1024 / 1024),
            bytes: memUsage.heapTotal,
        },
        used: {
            mb: Math.round(memUsage.heapUsed / 1024 / 1024),
            bytes: memUsage.heapUsed,
        },
        external: {
            mb: Math.round(memUsage.external / 1024 / 1024),
            bytes: memUsage.external,
        },
        rss: {
            mb: Math.round(memUsage.rss / 1024 / 1024),
            bytes: memUsage.rss,
        },
        available: {
            mb: Math.round((totalMemory - memUsage.rss) / 1024 / 1024),
            bytes: totalMemory - memUsage.rss,
        },
        limit: {
            mb: totalMemory / 1024 / 1024,
            bytes: totalMemory,
        },
        percentUsed: Math.round((memUsage.rss / totalMemory) * 100),
    });
});

export default router;
