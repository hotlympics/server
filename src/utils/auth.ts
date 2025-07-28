import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { authConfig } from '../config/auth.js';
import type { User } from '../models/user.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

const googleClient = new OAuth2Client(
    authConfig.google.clientId,
    authConfig.google.clientSecret,
    authConfig.google.redirectUri
);

export const hashPassword = async (password: string): Promise<string> => {
    return bcrypt.hash(password, authConfig.bcrypt.saltRounds);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(password, hash);
};

export const generateToken = (user: User): string => {
    const payload = { 
        id: user.id, 
        email: user.email,
        provider: user.provider 
    };

    return jwt.sign(
        payload, 
        authConfig.jwt.secret, 
        { expiresIn: authConfig.jwt.expiresIn }
    );
};

export const verifyToken = (token: string): any => {
    return jwt.verify(token, authConfig.jwt.secret);
};

export const verifyGoogleToken = async (code: string) => {
    try {
        const { tokens } = await googleClient.getToken({
            code,
            redirect_uri: authConfig.google.redirectUri,
        });

        const idToken = tokens.id_token;
        if (!idToken) {
            throw new Error('No ID token received');
        }

        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: authConfig.google.clientId,
        });

        const payload = ticket.getPayload();
        if (!payload) {
            throw new Error('Invalid token payload');
        }

        return {
            googleId: payload.sub,
            email: payload.email || '',
            name: payload.name || '',
            profilePicture: payload.picture || '',
        };
    } catch (error) {
        console.error('Google token verification error:', error);
        throw new Error('Failed to verify Google token');
    }
};
