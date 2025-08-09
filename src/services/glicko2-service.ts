import { GLICKO2_CONFIG } from '../config/glicko2-config.js';
import { Timestamp } from '@google-cloud/firestore';

export interface GlickoPlayerState {
    rating: number;        // Display rating R
    rd: number;            // Display rating deviation RD
    volatility: number;    // σ (sigma)
    mu: number;            // Internal rating μ
    phi: number;           // Internal deviation ϕ
    lastUpdateAt: Timestamp;
    systemVersion: 2;
}

export interface GlickoUpdateResult {
    rating: number;
    rd: number;
    volatility: number;
    mu: number;
    phi: number;
}

export class Glicko2Service {
    /**
     * Initialize Glicko state from existing battle count (on-demand)
     */
    static initializeFromBattleCount(legacyElo: number, battleCount: number): GlickoPlayerState {
        // Find appropriate RD based on battle count
        const rdMapping = GLICKO2_CONFIG.rdInitializationMap.find(
            mapping => battleCount >= mapping.minBattles
        );
        const initialRD = rdMapping?.rd ?? GLICKO2_CONFIG.defaultRD;
        
        // Convert to internal scale
        const mu = (legacyElo - GLICKO2_CONFIG.defaultRating) / GLICKO2_CONFIG.scale;
        const phi = initialRD / GLICKO2_CONFIG.scale;
        
        return {
            rating: legacyElo, // Keep continuity with existing Elo
            rd: initialRD,
            volatility: GLICKO2_CONFIG.defaultVolatility,
            mu,
            phi,
            lastUpdateAt: Timestamp.now(),
            systemVersion: 2,
        };
    }

    /**
     * Placeholder for battle update - will implement the full Glicko-2 math later
     */
    static updateBattle(winner: GlickoPlayerState, loser: GlickoPlayerState): {
        winner: GlickoUpdateResult;
        loser: GlickoUpdateResult;
    } {
        // For now, return unchanged states to ensure we don't break anything
        return {
            winner: {
                rating: winner.rating,
                rd: winner.rd,
                volatility: winner.volatility,
                mu: winner.mu,
                phi: winner.phi,
            },
            loser: {
                rating: loser.rating,
                rd: loser.rd,
                volatility: loser.volatility,
                mu: loser.mu,
                phi: loser.phi,
            },
        };
    }
}