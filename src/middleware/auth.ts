import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth.js';
import { findUserById } from '../models/user.js';

export interface AuthRequest extends Request {
    user?: any;
}

export const authMiddleware = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }
        
        const decoded = verifyToken(token);
        const user = findUserById(decoded.id);
        
        if (!user) {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};