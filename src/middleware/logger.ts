import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

interface ResponseWithTime extends Response {
    locals: {
        startTime?: number;
    };
}

const requestLogger = (req: Request, res: ResponseWithTime, next: NextFunction): void => {
    const startTime = Date.now();
    res.locals.startTime = startTime;

    const { method, url, ip } = req;
    const userAgent = req.get('user-agent') || 'Unknown';

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const status = res.statusCode;

        const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

        logger[logLevel](`${method} ${url} ${status} ${duration}ms - ${ip} - ${userAgent}`);
    });

    next();
};

export default requestLogger;
