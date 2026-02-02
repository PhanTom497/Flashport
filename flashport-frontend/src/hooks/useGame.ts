import { useState, useCallback, useRef, useEffect } from 'react';
import { useLineraWallet } from './useLineraWallet';
import type { BingoCard, GameSession, RollResult, GameStats } from '../types/game';

// Constants matching contract
export const MIN_BET_LINERA = 1;
export const MAX_BET_LINERA = 100;
export const ROLL_COST_LINERA = 0.05;

// Multiplier tiers for payout calculation
export const MULTIPLIER_TIERS = [
    { maxRolls: 9, multiplier: 10, tier: 'LEGENDARY' },
    { maxRolls: 14, multiplier: 5, tier: 'EPIC' },
    { maxRolls: 19, multiplier: 3, tier: 'RARE' },
    { maxRolls: 24, multiplier: 2, tier: 'GOOD' },
    { maxRolls: 34, multiplier: 1.2, tier: 'NORMAL' },
    { maxRolls: 44, multiplier: 0.8, tier: 'REDUCED' },
    { maxRolls: Infinity, multiplier: 0.2, tier: 'MINIMAL' },
];

// Helper to get current multiplier info
export function getMultiplierInfo(rolls: number) {
    const tier = MULTIPLIER_TIERS.find(t => rolls <= t.maxRolls) || MULTIPLIER_TIERS[MULTIPLIER_TIERS.length - 1];
    return tier;
}

interface PotentialPayout {
    betAmount: number;
    rollsCount: number;
    multiplier: string;
    potentialPayout: number;
    tierName: string;
}

const APP_ID = import.meta.env.VITE_FLASHPORT_APP_ID;

export function useGame() {
    // Get wallet context
    const { client, chainId, isConnected, balance, error: walletError, isConnecting, connect, disconnect, isReady } = useLineraWallet();

    // Connection status
    const [connectionError, setConnectionError] = useState<string | null>(null);

    // Game state
    const [session, setSession] = useState<GameSession | null>(null);
    const [card, setCard] = useState<BingoCard | null>(null);
    const [lastRoll, setLastRoll] = useState<RollResult | null>(null);
    const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
    const [stats, setStats] = useState<GameStats>({
        totalGames: 0,
        totalWins: 0,
        currentGameRolls: 0,
        winRate: 0,
    });

    // Token state
    const [playerBalance, setPlayerBalance] = useState<number>(0);
    const [totalSpent, setTotalSpent] = useState<number>(0);
    const [totalWon, setTotalWon] = useState<number>(0);
    const [chainBalance, setChainBalance] = useState<number>(0);

    // UI state
    const [isRolling, setIsRolling] = useState(false);
    const [autoRollEnabled, setAutoRollEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [txStatus, setTxStatus] = useState<string | null>(null);

    // Bet and payout state
    const [betAmount, setBetAmount] = useState(5);
    const [potentialPayout, setPotentialPayout] = useState<PotentialPayout | null>(null);

    const autoRollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Update chain balance from wallet context
    useEffect(() => {
        if (balance) {
            setChainBalance(parseFloat(balance));
        }
    }, [balance]);

    // Set connection error from wallet
    useEffect(() => {
        if (walletError) {
            setConnectionError(walletError);
        }
    }, [walletError]);

    // Execute GraphQL query/mutation via @linera/client
    const executeQuery = useCallback(async (queryString: string): Promise<any> => {
        if (!client || !chainId || !APP_ID) {
            throw new Error("Client not ready or chain ID missing");
        }

        try {
            // Updated for @linera/client 0.15.7: Client acts on default chain directly
            const app = await client.application(APP_ID);
            const responseJson = await app.query(JSON.stringify({ query: queryString }));
            const response = JSON.parse(responseJson);

            if (response.errors) {
                throw new Error(response.errors[0]?.message || 'GraphQL error');
            }

            return response.data;
        } catch (e: any) {
            console.error("GraphQL operation error:", e);
            throw e;
        }
    }, [client, chainId]);

    // Refresh game state from chain
    const refreshState = useCallback(async () => {
        if (!isConnected || !client || !chainId || !APP_ID) return;

        try {
            const data = await executeQuery(`{
                session { sessionId expiresAtMicros operationsCount }
                hasSession
                currentCard { id numbers marked rollsCount betAmountAtto }
                drawnNumbers
                totalGames
                totalWins
                rollHistoryCount
                lastRoll { dice sum matched gameOver isLucky }
                potentialPayout {
                    betAmountLinera
                    rollsCount
                    multiplier
                    potentialPayoutLinera
                    tierName
                }
                playerBalance {
                    availableAtto
                    totalDepositedAtto
                    totalWonAtto
                    totalSpentAtto
                }
                hasUnclaimedPrize
            }`);

            if (data.session) {
                setSession({
                    sessionId: parseInt(data.session.sessionId) || 0,
                    createdAtMicros: 0,
                    expiresAtMicros: parseInt(data.session.expiresAtMicros),
                    operationsCount: data.session.operationsCount,
                });
            } else {
                setSession(null);
            }

            if (data.currentCard) {
                setCard({
                    id: data.currentCard.id,
                    numbers: data.currentCard.numbers,
                    marked: data.currentCard.marked,
                    rollsCount: data.currentCard.rollsCount,
                });
            } else {
                setCard(null);
            }

            setDrawnNumbers(data.drawnNumbers || []);

            if (data.lastRoll) {
                const diceArray = data.lastRoll.dice as number[];
                setLastRoll({
                    dice: diceArray.length === 4
                        ? diceArray as [number, number, number, number]
                        : [1, 1, 1, 1],
                    sum: data.lastRoll.sum,
                    matched: data.lastRoll.matched,
                    matchRow: null,
                    matchCol: null,
                    bingoType: data.hasUnclaimedPrize ? 'Row0' : null,
                    gameOver: data.lastRoll.gameOver || data.hasUnclaimedPrize,
                    isLucky: data.lastRoll.isLucky,
                    rollsCount: data.currentCard?.rollsCount || 0,
                });

                if (data.lastRoll.gameOver || data.hasUnclaimedPrize) {
                    setAutoRollEnabled(false);
                }
            }

            setStats({
                totalGames: data.totalGames || 0,
                totalWins: data.totalWins || 0,
                currentGameRolls: data.currentCard?.rollsCount || 0,
                winRate: data.totalGames > 0
                    ? (data.totalWins / data.totalGames) * 100
                    : 0,
            });

            const attoToLinera = (atto: string) => {
                const num = parseFloat(atto || '0');
                return num / 1e18;
            };

            if (data.playerBalance) {
                setPlayerBalance(attoToLinera(data.playerBalance.availableAtto));
                setTotalSpent(attoToLinera(data.playerBalance.totalSpentAtto));
                setTotalWon(attoToLinera(data.playerBalance.totalWonAtto));
            }

            if (data.potentialPayout) {
                setPotentialPayout({
                    betAmount: data.potentialPayout.betAmountLinera,
                    rollsCount: data.potentialPayout.rollsCount,
                    multiplier: data.potentialPayout.multiplier,
                    potentialPayout: data.potentialPayout.potentialPayoutLinera,
                    tierName: data.potentialPayout.tierName,
                });
            } else {
                setPotentialPayout(null);
            }

            setConnectionError(null);
        } catch (e: any) {
            console.error('Failed to refresh state:', e);
            setConnectionError(e.message);
        }
    }, [isConnected, client, chainId, executeQuery]);

    // Poll for state updates when connected
    useEffect(() => {
        if (isConnected && chainId) {
            refreshState();
            const interval = setInterval(refreshState, 5000);
            return () => clearInterval(interval);
        }
    }, [isConnected, chainId, refreshState]);

    // Execute a GraphQL mutation
    const executeMutation = useCallback(async (mutation: string, description: string): Promise<boolean> => {
        if (!client || !chainId || !APP_ID) {
            setTxStatus('Not connected to blockchain');
            return false;
        }

        setIsLoading(true);
        setTxStatus(`Sending ${description}...`);

        try {
            await executeQuery(mutation);
            setTxStatus(`${description} confirmed!`);
            await refreshState();
            setTimeout(() => setTxStatus(null), 2000);
            return true;
        } catch (e: any) {
            console.error(`${description} failed:`, e);
            setTxStatus(`Error: ${e.message}`);
            setTimeout(() => setTxStatus(null), 5000);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [client, chainId, executeQuery, refreshState]);

    // === GAME OPERATIONS ===

    // Refresh native chain balance
    const refreshChainBalance = useCallback(async () => {
        if (balance) {
            setChainBalance(parseFloat(balance));
        }
    }, [balance]);

    // Deposit funds
    const deposit = useCallback(async (amountLinera: number = 10) => {
        await executeMutation(`mutation { deposit(amountLinera: ${amountLinera}) }`, `Deposit ${amountLinera}`);
    }, [executeMutation]);

    // Mint tokens
    const mintTokens = useCallback(async (amountLinera: number) => {
        if (amountLinera <= 0) return;

        setIsLoading(true);
        setTxStatus(`Minting ${amountLinera} FlashPort tokens...`);

        try {
            await executeMutation(`mutation { deposit(amountLinera: ${amountLinera}) }`, `Mint ${amountLinera} FP`);
            setTxStatus(`Successfully minted ${amountLinera} $FLASH tokens!`);
            setTimeout(() => setTxStatus(null), 3000);
        } catch (e: any) {
            setTxStatus(`Mint failed: ${e.message}`);
            setTimeout(() => setTxStatus(null), 5000);
        } finally {
            setIsLoading(false);
        }
    }, [executeMutation]);

    // Start session
    const startSession = useCallback(async () => {
        const success = await executeMutation(
            `mutation { startSession(expiresInSecs: 3600) }`,
            'Start Session'
        );
        if (success) {
            const now = Date.now() * 1000;
            setSession({
                sessionId: Date.now(),
                createdAtMicros: now,
                expiresAtMicros: now + 3600_000_000,
                operationsCount: 0,
            });
        }
    }, [executeMutation]);

    // End session
    const endSession = useCallback(async () => {
        // Immediate cleanup to stop loops
        setAutoRollEnabled(false);
        if (autoRollRef.current) {
            clearTimeout(autoRollRef.current);
            autoRollRef.current = null;
        }

        // Then attempt mutation
        await executeMutation(`mutation { endSession }`, 'End Session');
        setSession(null);
    }, [executeMutation]);

    // New game with bet amount
    const newGame = useCallback(async (customBetAmount?: number) => {
        if (!session) return;

        const bet = customBetAmount ?? betAmount;

        if (bet < MIN_BET_LINERA || bet > MAX_BET_LINERA) {
            setTxStatus(`Bet must be between ${MIN_BET_LINERA} and ${MAX_BET_LINERA} LINERA`);
            setTimeout(() => setTxStatus(null), 3000);
            return;
        }

        if (playerBalance < bet) {
            setTxStatus(`Need ${bet} LINERA. Current balance: ${playerBalance.toFixed(1)}`);
            setTimeout(() => setTxStatus(null), 3000);
            return;
        }

        setLastRoll(null);
        setDrawnNumbers([]);
        setPotentialPayout(null);
        await executeMutation(`mutation { newGame(betAmountLinera: ${bet}) }`, 'New Game');
    }, [session, betAmount, playerBalance, executeMutation]);

    // Roll dice
    const roll = useCallback(async () => {
        if (!session || !card || isRolling || lastRoll?.gameOver) return;

        if (playerBalance < ROLL_COST_LINERA) {
            setTxStatus(`Need ${ROLL_COST_LINERA} LINERA per roll`);
            setAutoRollEnabled(false);
            setTimeout(() => setTxStatus(null), 3000);
            return;
        }

        setIsRolling(true);

        try {
            await executeMutation(`mutation { rollAndMatch }`, 'Roll');
            if (lastRoll?.bingoType) {
                setAutoRollEnabled(false);
            }
        } finally {
            setIsRolling(false);
        }
    }, [session, card, isRolling, lastRoll?.gameOver, lastRoll?.bingoType, playerBalance, executeMutation]);

    // Claim prize guard
    const isClaimingRef = useRef(false);

    const claimPrize = useCallback(async () => {
        if (isClaimingRef.current) return;
        isClaimingRef.current = true;
        try {
            await executeMutation(`mutation { claimPrize }`, 'Claim Prize');
        } finally {
            isClaimingRef.current = false;
        }
    }, [executeMutation]);

    // Track auto-roll state in ref for timeout access
    const autoRollEnabledRef = useRef(false);

    // Toggle auto-roll
    const toggleAutoRoll = useCallback(() => {
        setAutoRollEnabled(prev => {
            const newValue = !prev;
            autoRollEnabledRef.current = newValue;
            if (!newValue && autoRollRef.current) {
                clearTimeout(autoRollRef.current);
                autoRollRef.current = null;
            }
            return newValue;
        });
    }, []);

    // Sync ref
    useEffect(() => {
        autoRollEnabledRef.current = autoRollEnabled;
    }, [autoRollEnabled]);

    // Auto-roll effect
    useEffect(() => {
        if (autoRollRef.current) {
            clearTimeout(autoRollRef.current);
            autoRollRef.current = null;
        }

        if (autoRollEnabled && session && card && !isRolling && !lastRoll?.gameOver && !isLoading && playerBalance >= ROLL_COST_LINERA) {
            autoRollRef.current = setTimeout(() => {
                // Double check ref to ensure we shouldn't have stopped
                if (autoRollEnabledRef.current) {
                    roll();
                }
            }, 1000);
        }

        return () => {
            if (autoRollRef.current) {
                clearTimeout(autoRollRef.current);
                autoRollRef.current = null;
            }
        };
    }, [autoRollEnabled, session, card, isRolling, lastRoll?.gameOver, isLoading, playerBalance, roll]);

    // Stub functions for backwards compatibility
    const updateChainId = useCallback(() => {
        console.log("updateChainId is deprecated - chain ID is now managed by wallet connection");
    }, []);

    const updateApplicationId = useCallback(() => {
        console.log("updateApplicationId is deprecated - app ID is now from environment");
    }, []);

    const checkConnection = useCallback(async () => {
        return isConnected;
    }, [isConnected]);

    return {
        // Configuration
        chainId,
        applicationId: APP_ID,
        updateChainId,
        updateApplicationId,

        // Connection status
        isConnected,
        connectionError,
        checkConnection,
        isReady,
        isConnecting,
        connect,
        disconnect,

        // Native chain balance
        chainBalance,

        // Token state
        playerBalance,
        totalSpent,
        totalWon,

        // Bet and payout
        betAmount,
        setBetAmount,
        potentialPayout,

        // Game state
        session,
        card,
        lastRoll,
        drawnNumbers,
        stats,
        isRolling,
        autoRollEnabled,
        isLoading,
        txStatus,

        // Actions
        deposit,
        mintTokens,
        refreshChainBalance,
        startSession,
        endSession,
        newGame,
        roll,
        claimPrize,
        toggleAutoRoll,
        refreshState,
    };
}
