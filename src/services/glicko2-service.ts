import { GLICKO2_CONFIG } from '../config/glicko2-config.js';
import { Timestamp } from '@google-cloud/firestore';

export interface GlickoPlayerState {
    rating: number; // Display rating R
    rd: number; // Display rating deviation RD
    volatility: number; // σ (sigma)
    mu: number; // Internal rating μ
    phi: number; // Internal deviation ϕ
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

export const glicko2Service = {
    /**
     * Initialize Glicko state from existing battle count (on-demand)
     */
    initializeFromBattleCount(legacyElo: number, battleCount: number): GlickoPlayerState {
        // Find appropriate RD based on battle count
        const rdMapping = GLICKO2_CONFIG.rdInitializationMap.find(
            (mapping) => battleCount >= mapping.minBattles,
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
    },

    /**
     * Update player ratings based on a single battle (winner vs loser)
     */
    updateBattle(
        winner: GlickoPlayerState,
        loser: GlickoPlayerState,
    ): {
        winner: GlickoUpdateResult;
        loser: GlickoUpdateResult;
    } {
        // Update winner (score = 1 against loser)
        const winnerResult = this.updatePlayer(winner, [loser], [1]);

        // Update loser (score = 0 against winner)
        const loserResult = this.updatePlayer(loser, [winner], [0]);

        return {
            winner: winnerResult,
            loser: loserResult,
        };
    },

    /**
     * Update a single player's rating against multiple opponents
     * @param player The player to update
     * @param opponents Array of opponent states
     * @param scores Array of scores (1 = win, 0 = loss, 0.5 = draw)
     */
    updatePlayer(
        player: GlickoPlayerState,
        opponents: GlickoPlayerState[],
        scores: number[],
    ): GlickoUpdateResult {
        const tau = GLICKO2_CONFIG.tau;

        // Step 1: Convert to Glicko-2 scale (internal μ, φ, σ)
        const mu = player.mu;
        const phi = player.phi;
        const sigma = player.volatility;

        // Step 2: Compute the estimated variance (v) and improvement (delta)
        let v = 0;
        let delta = 0;

        for (let i = 0; i < opponents.length; i++) {
            const opponentMu = opponents[i].mu;
            const opponentPhi = opponents[i].phi;
            const score = scores[i];

            // g(φ) function
            const g = 1 / Math.sqrt(1 + (3 * opponentPhi * opponentPhi) / (Math.PI * Math.PI));

            // E(μ, μj, φj) function - expected score
            const E = 1 / (1 + Math.exp(-g * (mu - opponentMu)));

            // Accumulate variance and delta
            const gSquaredE = g * g * E;
            v += gSquaredE * (1 - E);
            delta += g * (score - E);
        }

        // Invert variance
        v = 1 / v;
        delta *= v;

        // Step 3: Update volatility (σ') using iterative algorithm
        const newSigma = this.updateVolatility(sigma, phi, v, delta, tau);

        // Step 4: Update rating deviation (φ')
        const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);
        const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);

        // Step 5: Update rating (μ')
        const newMu = mu + newPhi * newPhi * (delta / v);

        // Step 6: Convert back to Glicko scale
        const newRating = GLICKO2_CONFIG.scale * newMu + GLICKO2_CONFIG.defaultRating;
        const newRD = Math.max(
            GLICKO2_CONFIG.minRD,
            Math.min(GLICKO2_CONFIG.maxRD, GLICKO2_CONFIG.scale * newPhi),
        );

        return {
            rating: Math.round(newRating),
            rd: Math.round(newRD * 100) / 100, // 2 decimal places
            volatility: newSigma,
            mu: newMu,
            phi: newPhi,
        };
    },

    /**
     * Update volatility using Illinois algorithm (variant of Regula Falsi)
     */
    updateVolatility(sigma: number, phi: number, v: number, delta: number, tau: number): number {
        const epsilon = GLICKO2_CONFIG.epsilon;

        // Function f(x) to find root of
        const f = (x: number): number => {
            const ex = Math.exp(x);
            const phiSquared = phi * phi;
            const term1 = ex * (delta * delta - phiSquared - v - ex);
            const term2 = 2 * (phiSquared + v + ex) * (phiSquared + v + ex);
            return term1 / term2 - (x - Math.log(sigma * sigma)) / (tau * tau);
        };

        // Initial bounds
        let A = Math.log(sigma * sigma);
        let B: number;

        if (delta * delta > phi * phi + v) {
            B = Math.log(delta * delta - phi * phi - v);
        } else {
            let k = 1;
            while (f(A - k * tau) < 0) {
                k++;
            }
            B = A - k * tau;
        }

        // Illinois algorithm
        let fA = f(A);
        let fB = f(B);

        while (Math.abs(B - A) > epsilon) {
            const C = A + ((A - B) * fA) / (fB - fA);
            const fC = f(C);

            if (fC * fB < 0) {
                A = B;
                fA = fB;
            } else {
                fA = fA / 2;
            }

            B = C;
            fB = fC;
        }

        return Math.exp(A / 2);
    },
};
