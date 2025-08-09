export const GLICKO2_CONFIG = {
    system: 'glicko2',
    version: 2,
    tau: 0.5,
    minRD: 50,
    maxRD: 350,
    defaultRating: 1500,
    defaultRD: 350,
    defaultVolatility: 0.06,
    scale: 173.7178, // Display ↔ internal conversion factor
    epsilon: 1e-6, // Root finding tolerance for volatility iteration

    // On-demand initialization RD mapping (adjustable)
    rdInitializationMap: [
        { minBattles: 150, rd: 50 },
        { minBattles: 80, rd: 65 },
        { minBattles: 40, rd: 90 },
        { minBattles: 20, rd: 120 },
        { minBattles: 10, rd: 170 },
        { minBattles: 5, rd: 220 },
        { minBattles: 1, rd: 280 },
        { minBattles: 0, rd: 350 },
    ],
} as const;

export type Glicko2Config = typeof GLICKO2_CONFIG;
