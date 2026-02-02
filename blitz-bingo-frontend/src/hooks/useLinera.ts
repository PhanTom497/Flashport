// FlashPort Game Hook - Direct GraphQL Integration
// Connects to linera service at localhost:8080

import { useState, useCallback, useRef, useEffect } from 'react';
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

// GraphQL endpoint - uses env variable (supports both local and testnet proxy)
const GRAPHQL_ENDPOINT = import.meta.env.VITE_LINERA_NODE_URL || 'http://localhost:8080';

interface GraphQLConfig {
    chainId: string;
    applicationId: string;
}

async function graphqlQuery(config: GraphQLConfig, query: string): Promise<unknown> {
    const url = `${GRAPHQL_ENDPOINT}/chains/${config.chainId}/applications/${config.applicationId}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
    });

    if (!response.ok) {
        throw new Error(`GraphQL error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (result.errors) {
        throw new Error(result.errors[0]?.message || 'GraphQL error');
    }

    return result.data;
}

export function useGame() {
    // Configuration from localStorage
    const [chainId, setChainId] = useState<string | null>(
        localStorage.getItem('linera_chain_id')
    );
    const [applicationId, setApplicationId] = useState<string | null>(
        localStorage.getItem('blitz_app_id')
    );

    // Connection status
    const [isConnected, setIsConnected] = useState(false);
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
    const [chainBalance, setChainBalance] = useState<number>(0); // Native Linera balance

    // UI state
    const [isRolling, setIsRolling] = useState(false);
    const [autoRollEnabled, setAutoRollEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [txStatus, setTxStatus] = useState<string | null>(null);

    // Bet and payout state
    const [betAmount, setBetAmount] = useState(5); // Default 5 LINERA
    const [potentialPayout, setPotentialPayout] = useState<PotentialPayout | null>(null);

    const autoRollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Save config to localStorage
    const updateChainId = useCallback((id: string) => {
        setChainId(id);
        localStorage.setItem('linera_chain_id', id);
    }, []);

    const updateApplicationId = useCallback((id: string) => {
        setApplicationId(id);
        localStorage.setItem('blitz_app_id', id);
    }, []);

    // Check connection to linera service
    const checkConnection = useCallback(async () => {
        if (!chainId || !applicationId) {
            setIsConnected(false);
            return false;
        }

        try {
            await graphqlQuery(
                { chainId, applicationId },
                `{ __typename }`
            );
            setIsConnected(true);
            setConnectionError(null);
            return true;
        } catch (e: unknown) {
            const err = e as Error;
            console.error('Connection check failed:', e);
            setIsConnected(false);
            setConnectionError(err.message);
            return false;
        }
    }, [chainId, applicationId]);

    // Refresh game state from chain
    const refreshState = useCallback(async () => {
        if (!chainId || !applicationId) return;

        // Response interface for game state query
        interface GameStateResponse {
            session: { sessionId: string; expiresAtMicros: string; operationsCount: number } | null;
            hasSession: boolean;
            currentCard: { id: number; numbers: number[]; marked: boolean[]; rollsCount: number; betAmountAtto: string } | null;
            drawnNumbers: number[];
            totalGames: number;
            totalWins: number;
            rollHistoryCount: number;
            lastRoll: { dice: number[]; sum: number; matched: boolean; gameOver: boolean; isLucky: boolean } | null;
            potentialPayout: { betAmountLinera: number; rollsCount: number; multiplier: string; potentialPayoutLinera: number; tierName: string } | null;
            playerBalance: { availableAtto: string; totalDepositedAtto: string; totalWonAtto: string; totalSpentAtto: string } | null;
            hasUnclaimedPrize: boolean;
        }

        try {
            const data = await graphqlQuery(
                { chainId, applicationId },
                `{
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
                }`
            ) as GameStateResponse;

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

            // Update last roll result with actual dice from blockchain
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

                // Auto-disable auto-roll when game is over
                if (data.lastRoll.gameOver || data.hasUnclaimedPrize) {
                    setAutoRollEnabled(false);
                }
            }

            // Update stats from available data
            setStats({
                totalGames: data.totalGames || 0,
                totalWins: data.totalWins || 0,
                currentGameRolls: data.currentCard?.rollsCount || 0,
                winRate: data.totalGames > 0
                    ? (data.totalWins / data.totalGames) * 100
                    : 0,
            });

            // Convert from atto (10^18) to LINERA
            const attoToLinera = (atto: string) => {
                const num = parseFloat(atto || '0');
                return num / 1e18;
            };

            if (data.playerBalance) {
                setPlayerBalance(attoToLinera(data.playerBalance.availableAtto));
                setTotalSpent(attoToLinera(data.playerBalance.totalSpentAtto));
                setTotalWon(attoToLinera(data.playerBalance.totalWonAtto));
            }

            // Update potential payout display
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

            setIsConnected(true);
            setConnectionError(null);
        } catch (e: unknown) {
            const err = e as Error;
            console.error('Failed to refresh state:', e);
            setConnectionError(err.message);
        }
    }, [chainId, applicationId]);

    // Check connection on mount and when config changes
    useEffect(() => {
        if (chainId && applicationId) {
            checkConnection().then(connected => {
                if (connected) {
                    refreshState();
                }
            });
        }
    }, [chainId, applicationId, checkConnection, refreshState]);

    // Execute a GraphQL mutation
    const executeMutation = useCallback(async (mutation: string, description: string): Promise<boolean> => {
        if (!chainId || !applicationId) {
            setTxStatus('Not connected to blockchain');
            return false;
        }

        setIsLoading(true);
        setTxStatus(`Sending ${description}...`);

        try {
            await graphqlQuery({ chainId, applicationId }, mutation);
            setTxStatus(`${description} confirmed!`);

            // Refresh state after mutation
            await refreshState();

            setTimeout(() => setTxStatus(null), 2000);
            return true;
        } catch (e: unknown) {
            const err = e as Error;
            console.error(`${description} failed:`, e);
            setTxStatus(`Error: ${err.message}`);
            setTimeout(() => setTxStatus(null), 5000);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [chainId, applicationId, refreshState]);

    // === GAME OPERATIONS ===

    // Refresh native chain balance from Linera
    const refreshChainBalance = useCallback(async () => {
        if (!chainId) return;

        try {
            // Query chain state for balance using correct GraphQL path
            const response = await fetch(GRAPHQL_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `query { chain(chainId: "${chainId}") { executionState { system { balance } } } }`
                }),
            });

            if (response.ok) {
                const result = await response.json();
                const balanceStr = result.data?.chain?.executionState?.system?.balance;
                if (balanceStr) {
                    // Balance is returned as string like "48.505201834"
                    const balance = parseFloat(balanceStr);
                    setChainBalance(isNaN(balance) ? 0 : balance);
                }
            }
        } catch (e) {
            console.error('Failed to fetch chain balance:', e);
        }
    }, [chainId]);

    // Deposit funds (generic)
    const deposit = useCallback(async (amountLinera: number = 10) => {
        await executeMutation(`mutation { deposit(amountLinera: ${amountLinera}) }`, `Deposit ${amountLinera}`);
        await refreshChainBalance();
    }, [executeMutation, refreshChainBalance]);

    // Mint tokens - deposit a specific amount
    const mintTokens = useCallback(async (amountLinera: number) => {
        if (amountLinera <= 0) return;

        setIsLoading(true);
        setTxStatus(`Minting ${amountLinera} FlashPort tokens...`);

        try {
            // Call deposit mutation with the specific amount
            await executeMutation(`mutation { deposit(amountLinera: ${amountLinera}) }`, `Mint ${amountLinera} FP`);

            // Refresh both balances
            await refreshChainBalance();
            await refreshState();

            setTxStatus(`Successfully minted ${amountLinera} $FLASH tokens!`);
            setTimeout(() => setTxStatus(null), 3000);
        } catch (e: unknown) {
            const err = e as Error;
            setTxStatus(`Mint failed: ${err.message}`);
            setTimeout(() => setTxStatus(null), 5000);
        } finally {
            setIsLoading(false);
        }
    }, [executeMutation, refreshChainBalance, refreshState]);

    // Start session
    const startSession = useCallback(async () => {
        const success = await executeMutation(
            `mutation { startSession(expiresInSecs: 3600) }`,
            'Start Session'
        );
        if (success) {
            // Also set local session for immediate UI feedback
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
        await executeMutation(`mutation { endSession }`, 'End Session');
        setSession(null);
        setAutoRollEnabled(false);
        if (autoRollRef.current) {
            clearTimeout(autoRollRef.current);
        }
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

            // Check if we won (refresh will update the state)
            if (lastRoll?.bingoType) {
                setAutoRollEnabled(false);
            }
        } finally {
            setIsRolling(false);
        }
    }, [session, card, isRolling, lastRoll?.gameOver, lastRoll?.bingoType, playerBalance, executeMutation]);

    // Claim prize
    const claimPrize = useCallback(async () => {
        await executeMutation(`mutation { claimPrize }`, 'Claim Prize');
    }, [executeMutation]);

    // Toggle auto-roll - immediately clears any pending timeout
    const toggleAutoRoll = useCallback(() => {
        setAutoRollEnabled(prev => {
            const newValue = !prev;
            // If turning off, immediately clear any pending timeout
            if (!newValue && autoRollRef.current) {
                clearTimeout(autoRollRef.current);
                autoRollRef.current = null;
            }
            return newValue;
        });
    }, []);

    // Auto-roll effect - with longer delay for better control
    useEffect(() => {
        // Clear any existing timeout first
        if (autoRollRef.current) {
            clearTimeout(autoRollRef.current);
            autoRollRef.current = null;
        }

        // Only schedule next roll if conditions are met
        if (autoRollEnabled && session && card && !isRolling && !lastRoll?.gameOver && !isLoading && playerBalance >= ROLL_COST_LINERA) {
            autoRollRef.current = setTimeout(() => {
                roll();
            }, 1000); // 1 second delay for better user control
        }

        return () => {
            if (autoRollRef.current) {
                clearTimeout(autoRollRef.current);
                autoRollRef.current = null;
            }
        };
    }, [autoRollEnabled, session, card, isRolling, lastRoll?.gameOver, isLoading, playerBalance, roll]);

    return {
        // Configuration
        chainId,
        applicationId,
        updateChainId,
        updateApplicationId,

        // Connection status
        isConnected,
        connectionError,
        checkConnection,

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
