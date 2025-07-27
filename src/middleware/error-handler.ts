import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

interface ErrorWithStatus extends Error {
    status?: number;
    statusCode?: number;
}

const globalErrorHandler = (
    err: ErrorWithStatus,
    req: Request,
    res: Response,
    _next: NextFunction,
): void => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    logger.error(`Error ${status}: ${message}`, {
        url: req.url,
        method: req.method,
        ip: req.ip,
        error: err.stack,
    });

    res.status(status).json({
        error: {
            message:
                process.env.NODE_ENV === 'production' && status === 500
                    ? 'Internal Server Error'
                    : message,
            status,
        },
    });
};

export default globalErrorHandler;
