import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { globalErrorHandler, requestLogger, notFoundHandler } from './middleware/index.js';
import routes from './routes/index.js';

const createApp = (): express.Application => {
    const app = express();

    app.locals.startTime = new Date();
    app.locals.version = '0.0.0';

    app.set('trust proxy', 1);

    app.use(
        helmet({
            contentSecurityPolicy: false,
            crossOriginEmbedderPolicy: false,
        }),
    );

    app.use(
        cors({
            origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'],
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'X-Requested-With',
                'Accept',
                'Cache-Control',
            ],
            credentials: true,
        }),
    );

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    app.use(requestLogger);

    app.use('/', routes);

    app.use(notFoundHandler);

    app.use(globalErrorHandler);

    return app;
};

export default createApp;
