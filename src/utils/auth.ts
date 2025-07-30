import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { authConfig } from '../config/auth.js';
import { createRequire } from 'module';
import { User } from '../types/user';

interface TokenPayload {
    id: string;
    email: string;
}

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken') as {
    sign: (
        payload: Record<string, unknown>,
        secret: string,
        options?: { expiresIn: string },
    ) => string;
    verify: (token: string, secret: string) => TokenPayload;
};

const googleClient = new OAuth2Client(
    authConfig.google.clientId,
    authConfig.google.clientSecret,
    authConfig.google.redirectUri,
);

export const verifyEmail = (email: string): { result: boolean; message: string } => {
    if (!email) {
        return {
            result: false,
            message: 'Email must be set',
        };
    }

    return {
        result: true,
        message: '',
    };
};

export const verifyPassword = (password: string): { result: boolean; message: string } => {
    if (!password) {
        return {
            result: false,
            message: 'Password must be set',
        };
    }

    if (password.length < 6) {
        return {
            result: false,
            message: 'Password must be at least 6 characters',
        };
    }

    return {
        result: true,
        message: '',
    };
};

export const createUser = (
    email: string,
    googleId: string | null = null,
    password: string | null = null,
): User => {
    return {
        id: crypto.randomUUID(),
        email: email,
        googleId: googleId,
        password: password,
        gender: 'unknown',
        dateOfBirth: null,
        rateCount: 0,
    } as User;
};

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
    };

    return jwt.sign(payload, authConfig.jwt.secret, { expiresIn: authConfig.jwt.expiresIn });
};

export const verifyToken = (token: string): TokenPayload => {
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
            // name: payload.name || '',
            // profilePicture: payload.picture || '',
        };
    } catch (error) {
        console.error('Google token verification error:', error);
        throw new Error('Failed to verify Google token');
    }
};
