// FlashPort type definitions matching the Linera contract

export interface BingoCard {
    id: number;
    numbers: number[];  // 25 elements (5x5 flattened)
    marked: boolean[];  // 25 elements
    rollsCount: number;
}

export interface GameSession {
    sessionId: number;
    createdAtMicros: number;
    expiresAtMicros: number;
    operationsCount: number;
}

export interface RollResult {
    dice: number[];
    sum: number;
    matched: boolean;
    matchRow: number | null;
    matchCol: number | null;
    bingoType: BingoType | null;
    gameOver: boolean;
    rollsCount: number;
    isLucky: boolean;
}

export type BingoType =
    | 'Row0' | 'Row1' | 'Row2' | 'Row3' | 'Row4'
    | 'Col0' | 'Col1' | 'Col2' | 'Col3' | 'Col4'
    | 'DiagonalMain' | 'DiagonalAnti' | 'FullCard';

export interface GameStats {
    totalGames: number;
    totalWins: number;
    currentGameRolls: number;
    winRate: number;
}

export interface GameState {
    session: GameSession | null;
    card: BingoCard | null;
    lastRoll: RollResult | null;
    drawnNumbers: number[];
    stats: GameStats;
    isRolling: boolean;
    autoRollEnabled: boolean;
}
