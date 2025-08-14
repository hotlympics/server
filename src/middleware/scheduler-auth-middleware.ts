import { Request, Response, NextFunction } from 'express';

const SCHEDULER_API_KEY = process.env.SCHEDULER_API_KEY;

export interface SchedulerRequest extends Request {
    isScheduler?: boolean;
}

export const schedulerAuthMiddleware = (
    req: SchedulerRequest,
    res: Response,
    next: NextFunction,
): void => {
    try {
        // Check for API key in header
        const apiKey =
            req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

        if (!apiKey || !SCHEDULER_API_KEY || apiKey !== SCHEDULER_API_KEY) {
            res.status(401).json({ error: { message: 'Scheduler access denied' } });
            return;
        }

        req.isScheduler = true;
        next();
    } catch (error) {
        res.status(401).json({ error: { message: 'Invalid scheduler credentials' } });
    }
};
