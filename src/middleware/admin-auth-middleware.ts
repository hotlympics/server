import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET || 'default-admin-secret-change-in-production';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export interface AdminRequest extends Request {
    isAdmin?: boolean;
}

export const adminAuthMiddleware = (req: AdminRequest, res: Response, next: NextFunction): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: { message: 'Admin access denied' } });
            return;
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, ADMIN_SECRET) as { isAdmin: boolean };

        if (!decoded.isAdmin) {
            res.status(401).json({ error: { message: 'Admin access denied' } });
            return;
        }

        req.isAdmin = true;
        next();
    } catch (error) {
        res.status(401).json({ error: { message: 'Invalid admin token' } });
    }
};

export const adminCredentials = {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
    secret: ADMIN_SECRET,
};
