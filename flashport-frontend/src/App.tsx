import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame, MIN_BET_LINERA, MAX_BET_LINERA, ROLL_COST_LINERA } from './hooks/useGame';
import { BingoCard } from './components/BingoCard';
import { DiceShaker } from './components/DiceShaker';
import { SessionIndicator } from './components/SessionIndicator';
import { DrawnNumbers } from './components/DrawnNumbers';
import { GameStatsDisplay } from './components/GameStats';
import { WinModal } from './components/WinModal';
import { AssetFaucets } from './components/AssetFaucets';
import { QuickBetChips } from './components/QuickBetChips';


type TabType = 'game' | 'faucet';

function App() {
    const {
        // Config
        chainId,
        applicationId,

        // Connection
        isConnected,
        connectionError,
        isConnecting,
        connect,
        disconnect,

        // Token state
        playerBalance,
        totalSpent,
        totalWon,
        chainBalance,

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
        mintTokens,
        refreshChainBalance,
        startSession,
        endSession,
        newGame,
        roll,
        claimPrize,
        toggleAutoRoll,
        refreshState,
    } = useGame();



    const [showWinModal, setShowWinModal] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('game');
    const [showConfig, setShowConfig] = useState(false);

    // Refresh chain balance on mount and when chainId changes
    useEffect(() => {
        if (chainId) {
            refreshChainBalance();
        }
    }, [chainId, refreshChainBalance]);

    // Handle wallet connect
    const handleConnectWallet = async () => {
        await connect();
        setShowConfig(false);
    };

    // Get last match position
    const lastMatchPos = lastRoll?.matched && lastRoll.matchRow !== null && lastRoll.matchCol !== null
        ? { row: lastRoll.matchRow, col: lastRoll.matchCol }
        : null;

    const handleNewGameFromModal = () => {
        setShowWinModal(false);
        newGame();
    };

    const shouldShowModal = showWinModal && lastRoll?.bingoType;
    const showSetupPanel = !isConnected || !chainId || !applicationId;

    // Get multiplier tier display
    const getMultiplierClass = () => {
        if (!potentialPayout) return 'normal';
        const rolls = potentialPayout.rollsCount;
        if (rolls <= 9) return 'legendary';
        if (rolls <= 19) return 'epic';
        return 'normal';
    };

    return (
        <div className="min-h-screen">
            {/* Premium Header */}
            <header className="sticky top-0 z-30 backdrop-blur-xl bg-[rgba(5,7,10,0.85)] border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <motion.div
                                className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-amber-500 flex items-center justify-center shadow-lg"
                                whileHover={{ scale: 1.05, rotate: 5 }}
                            >
                                <span className="text-xl">⚡</span>
                            </motion.div>
                            <div>
                                <h1 className="text-xl font-black text-white">FlashPort</h1>
                                <p className="text-xs text-secondary -mt-0.5">High-Stakes Dice Bingo</p>
                            </div>
                        </div>

                        {/* Tab Navigation */}
                        <div className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl">
                            <button
                                onClick={() => setActiveTab('game')}
                                className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all ${activeTab === 'game'
                                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                                    : 'text-secondary hover:text-white'
                                    }`}
                            >
                                🎲 Bingo
                            </button>

                            <button
                                onClick={() => setActiveTab('faucet')}
                                className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all ${activeTab === 'faucet'
                                    ? 'bg-gradient-to-r from-purple-500 to-amber-500 text-white shadow-lg'
                                    : 'text-secondary hover:text-white'
                                    }`}
                            >
                                💎 Faucets
                            </button>
                        </div>

                        {/* Balance & Actions */}
                        <div className="flex items-center gap-4">
                            {/* Balance Display */}
                            <div className="hidden sm:flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-[10px] text-secondary uppercase tracking-wider">Linera</p>
                                    <p className="text-sm font-bold text-blue-400">{chainBalance.toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-secondary uppercase tracking-wider">$FLASH</p>
                                    <motion.p
                                        className="text-lg font-black flash-balance"
                                        key={playerBalance}
                                        initial={{ scale: 1.1 }}
                                        animate={{ scale: 1 }}
                                    >
                                        {playerBalance.toFixed(2)}
                                    </motion.p>
                                </div>
                            </div>

                            {/* Deposit Button */}
                            <motion.button
                                onClick={() => setActiveTab('faucet')}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500/20 to-amber-500/20 border border-purple-500/30 text-white font-semibold text-sm"
                                whileHover={{ scale: 1.02, borderColor: 'rgba(139, 92, 246, 0.6)' }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <span className="text-lg">💰</span>
                                <span className="hidden sm:inline">Deposit</span>
                            </motion.button>

                            {/* Config Toggle */}
                            <button
                                onClick={() => setShowConfig(!showConfig)}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                ⚙️
                            </button>
                        </div>
                    </div>

                    {/* Mobile Tab Navigation */}
                    <div className="flex md:hidden items-center gap-2 mt-3 overflow-x-auto pb-1">
                        <button
                            onClick={() => setActiveTab('game')}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all ${activeTab === 'game'
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                : 'bg-white/5 text-secondary'
                                }`}
                        >
                            🎮 Game
                        </button>
                        <button
                            onClick={() => setActiveTab('faucet')}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all ${activeTab === 'faucet'
                                ? 'bg-gradient-to-r from-purple-500 to-amber-500 text-white'
                                : 'bg-white/5 text-secondary'
                                }`}
                        >
                            💎 Faucets
                        </button>
                    </div>
                </div>

                {/* Config Panel */}
                <AnimatePresence>
                    {showConfig && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-white/5"
                        >
                            <div className="max-w-7xl mx-auto px-4 py-4">
                                <div className="glass-card p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                                            <span className={isConnected ? 'text-green-400 text-sm' : 'text-red-400 text-sm'}>
                                                {isConnected ? 'Connected to Linera' : 'Not Connected'}
                                            </span>
                                        </div>
                                        <button onClick={refreshState} className="text-xs text-secondary hover:text-white">
                                            🔄 Refresh
                                        </button>
                                    </div>

                                    {isConnected ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs text-secondary block mb-1">Chain ID</label>
                                                <p className="text-white text-sm font-mono bg-white/5 rounded-lg px-3 py-2 truncate">
                                                    {chainId || 'N/A'}
                                                </p>
                                            </div>
                                            <div>
                                                <label className="text-xs text-secondary block mb-1">Application ID</label>
                                                <p className="text-white text-sm font-mono bg-white/5 rounded-lg px-3 py-2 truncate">
                                                    {applicationId || 'N/A'}
                                                </p>
                                            </div>
                                            <button onClick={disconnect} className="w-full py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 font-semibold text-sm hover:bg-red-500/20 transition-all">
                                                🔌 Disconnect Wallet
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <p className="text-secondary text-sm mb-4">Connect your MetaMask wallet to start playing.</p>
                                            <button
                                                onClick={handleConnectWallet}
                                                disabled={isConnecting}
                                                className="btn-primary text-sm py-3 px-8"
                                            >
                                                {isConnecting ? '⏳ Connecting...' : '🦊 Connect MetaMask'}
                                            </button>
                                        </div>
                                    )}
                                    {connectionError && (
                                        <p className="text-red-400 text-xs mt-2">⚠️ {connectionError}</p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </header>

            {/* Transaction Status Toast */}
            <AnimatePresence>
                {txStatus && (
                    <motion.div
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -100, opacity: 0 }}
                        className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-amber-500/20 to-purple-500/20 backdrop-blur-xl border border-amber-500/30 rounded-xl px-6 py-3 text-amber-200"
                    >
                        ⏳ {txStatus}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Lucky Notification */}
            <AnimatePresence>
                {lastRoll?.isLucky && !lastRoll.gameOver && (
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
                    >
                        <div className="glass-card-glow px-8 py-4 flex items-center gap-4 border border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                            <span className="text-4xl">🍀</span>
                            <div>
                                <p className="text-emerald-400 font-bold text-xl uppercase tracking-widest">Lucky Hit!</p>
                                <p className="text-emerald-200/80 text-sm">Multiple numbers matched!</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Asset Faucets Tab */}
                <AnimatePresence mode="wait">
                    {activeTab === 'faucet' && (
                        <motion.div
                            key="faucet"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <AssetFaucets
                                lineraBalance={chainBalance}
                                flashportBalance={playerBalance}
                                onMint={mintTokens}
                                isLoading={isLoading}
                                chainId={chainId}
                            />
                        </motion.div>
                    )}



                    {/* Game Tab */}
                    {activeTab === 'game' && showSetupPanel && (
                        <motion.div
                            key="setup"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="glass-card max-w-2xl mx-auto text-center py-12"
                        >
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-amber-500/20 flex items-center justify-center">
                                <span className="text-3xl">🦊</span>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-3">Connect Wallet</h2>
                            <p className="text-secondary mb-6 max-w-md mx-auto">
                                Connect your MetaMask wallet to start playing on the Linera Conway testnet.
                            </p>
                            <button
                                onClick={handleConnectWallet}
                                disabled={isConnecting}
                                className="btn-primary text-lg px-8 py-3"
                            >
                                {isConnecting ? '⏳ Connecting...' : '🦊 Connect MetaMask'}
                            </button>
                            {connectionError && (
                                <p className="text-red-400 text-sm mt-4">⚠️ {connectionError}</p>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'game' && !showSetupPanel && !session && (
                        <motion.div
                            key="no-session"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="glass-card-glow max-w-2xl mx-auto text-center py-12"
                        >
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                                <span className="text-3xl">✓</span>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Connected to Linera</h2>
                            <p className="text-secondary mb-6">
                                Balance: <span className="flash-balance text-xl">{playerBalance.toFixed(2)} $FLASH</span>
                            </p>

                            {playerBalance < MIN_BET_LINERA && (
                                <div className="mb-6">
                                    <p className="text-amber-400 mb-3">Need at least {MIN_BET_LINERA} $FLASH to play</p>
                                    <button onClick={() => setActiveTab('faucet')} className="btn-secondary">
                                        💎 Get $FLASH Tokens
                                    </button>
                                </div>
                            )}

                            <motion.button
                                onClick={startSession}
                                disabled={isLoading}
                                className="btn-primary text-xl px-12 py-4"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                🚀 Start Session
                            </motion.button>
                        </motion.div>
                    )}

                    {activeTab === 'game' && !showSetupPanel && session && !card && (
                        <motion.div
                            key="new-game"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="glass-card-glow max-w-xl mx-auto text-center py-10"
                        >
                            <h2 className="text-2xl font-bold text-white mb-2">Session Active ✓</h2>
                            <p className="text-secondary mb-6">
                                Balance: <span className="flash-balance text-xl">{playerBalance.toFixed(2)} $FLASH</span>
                            </p>

                            {/* Quick Bet Chips */}
                            <div className="mb-8">
                                <QuickBetChips
                                    selectedAmount={betAmount}
                                    onSelect={setBetAmount}
                                    maxBet={Math.min(MAX_BET_LINERA, Math.floor(playerBalance))}
                                    disabled={isLoading}
                                />
                            </div>

                            <p className="text-green-400 text-sm mb-6">
                                🏆 Potential Win: Up to <span className="font-bold">{(betAmount * 10).toFixed(0)} $FLASH</span> (10x)
                            </p>

                            {playerBalance >= MIN_BET_LINERA ? (
                                <motion.button
                                    onClick={() => newGame(betAmount)}
                                    disabled={isLoading}
                                    className="btn-primary text-xl px-12 py-4"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    🎮 Start Game ({betAmount} $FLASH)
                                </motion.button>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-red-400">Insufficient balance!</p>
                                    <button onClick={() => setActiveTab('faucet')} className="btn-primary">
                                        💎 Get $FLASH Tokens
                                    </button>
                                </div>
                            )}

                            <div className="mt-6 flex justify-center">
                                <SessionIndicator
                                    session={session}
                                    onStartSession={startSession}
                                    onEndSession={endSession}
                                />
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'game' && !showSetupPanel && session && card && (
                        <motion.div
                            key="active-game"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            {/* Potential Payout Ticker */}
                            <div className="text-center mb-6">
                                <p className="text-xs text-secondary uppercase tracking-wider mb-1">Potential Win</p>
                                <motion.div
                                    className={`win-ticker ${getMultiplierClass()}`}
                                    key={potentialPayout?.potentialPayout || betAmount}
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: 'spring', stiffness: 400 }}
                                >
                                    {potentialPayout
                                        ? `${potentialPayout.potentialPayout.toFixed(1)} $FLASH`
                                        : `${(betAmount * 10).toFixed(0)} $FLASH`
                                    }
                                </motion.div>
                                {potentialPayout && (
                                    <p className="text-sm text-secondary mt-1">
                                        {potentialPayout.multiplier} • {potentialPayout.tierName}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Bingo Card */}
                                <div className="lg:col-span-2 space-y-6">
                                    <BingoCard
                                        card={card}
                                        lastMatchPos={lastMatchPos}
                                        winningLine={lastRoll?.bingoType}
                                    />

                                    {/* Collapsible Drawn Numbers */}
                                    <details className="glass-card p-4">
                                        <summary className="cursor-pointer text-white font-semibold flex items-center gap-2">
                                            <span>📊 Game Info</span>
                                            <span className="text-xs text-secondary">({drawnNumbers.length} drawn)</span>
                                        </summary>
                                        <div className="mt-4 space-y-4">
                                            <DrawnNumbers numbers={drawnNumbers} />
                                            <GameStatsDisplay stats={stats} />
                                        </div>
                                    </details>
                                </div>

                                {/* Dice & Controls */}
                                <div className="space-y-6">
                                    <DiceShaker
                                        dice={lastRoll?.dice || [1, 1, 1, 1]}
                                        isRolling={isRolling}
                                        onRoll={roll}
                                        disabled={!session || !card || lastRoll?.gameOver || playerBalance < ROLL_COST_LINERA || isLoading}
                                        autoRollEnabled={autoRollEnabled}
                                        onToggleAutoRoll={toggleAutoRoll}
                                    />

                                    {/* Balance Display */}
                                    <div className="glass-card p-4 text-center">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <p className="text-xs text-secondary uppercase">Balance</p>
                                                <p className="text-lg font-bold flash-balance">{playerBalance.toFixed(1)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-secondary uppercase">Spent</p>
                                                <p className="text-lg font-bold text-red-400">{totalSpent.toFixed(1)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-secondary uppercase">Won</p>
                                                <p className="text-lg font-bold text-green-400">{totalWon.toFixed(1)}</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-secondary mt-3">
                                            Roll costs <span className="text-green-400 font-bold">{ROLL_COST_LINERA} $FLASH</span>
                                        </p>
                                    </div>

                                    {/* End Session Button */}
                                    <motion.button
                                        onClick={async () => {
                                            await endSession();
                                            await refreshState();
                                        }}
                                        disabled={isLoading}
                                        className="w-full py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 font-semibold hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                    >
                                        <span>🚪</span>
                                        End Session & Return Home
                                    </motion.button>

                                    {/* Game Over Actions */}
                                    {lastRoll?.gameOver && (
                                        <motion.div
                                            className="space-y-3"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                        >
                                            <div className="glass-card-glow text-center py-4">
                                                <p className="text-amber-400 text-lg font-bold">🏆 BINGO!</p>
                                                {potentialPayout ? (
                                                    <>
                                                        <motion.p
                                                            className="text-3xl font-black text-green-400"
                                                            animate={{ scale: [1, 1.05, 1] }}
                                                            transition={{ duration: 1, repeat: Infinity }}
                                                        >
                                                            +{potentialPayout.potentialPayout.toFixed(1)} $FLASH
                                                        </motion.p>
                                                        <p className="text-sm text-secondary">{potentialPayout.multiplier} • {potentialPayout.tierName}</p>
                                                    </>
                                                ) : (
                                                    <p className="text-2xl font-black text-green-400">Prize Claimed! ✓</p>
                                                )}
                                            </div>

                                            {potentialPayout && (
                                                <motion.button
                                                    onClick={async () => {
                                                        await claimPrize();
                                                        await refreshState();
                                                    }}
                                                    disabled={isLoading}
                                                    className="w-full py-4 rounded-xl font-bold text-lg text-black"
                                                    style={{
                                                        background: 'linear-gradient(135deg, #FFD700 0%, #F59E0B 100%)',
                                                        boxShadow: '0 0 30px rgba(245, 158, 11, 0.5)',
                                                    }}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                >
                                                    💰 Claim {potentialPayout.potentialPayout.toFixed(1)} $FLASH
                                                </motion.button>
                                            )}

                                            {!potentialPayout && (
                                                <motion.button
                                                    onClick={() => newGame(betAmount)}
                                                    disabled={playerBalance < MIN_BET_LINERA || isLoading}
                                                    className="btn-primary w-full text-lg py-4"
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                >
                                                    🎮 New Game ({betAmount} $FLASH)
                                                </motion.button>
                                            )}
                                        </motion.div>
                                    )}

                                    {/* Insufficient Balance Warning */}
                                    {playerBalance < ROLL_COST_LINERA && !lastRoll?.gameOver && (
                                        <div className="text-center glass-card p-4">
                                            <p className="text-red-400 mb-3">Insufficient balance!</p>
                                            <button onClick={() => setActiveTab('faucet')} className="btn-secondary">
                                                💎 Get $FLASH
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Footer */}
            <footer className="text-center text-secondary text-xs py-8 border-t border-white/5 mt-12">
                <p>
                    Built on <span className="text-blue-400">Linera Conway Testnet</span> •
                    <span className="text-flash"> FlashPort</span> Gaming Hub
                </p>
                <p className="mt-1 text-muted">
                    Sub-200ms finality • On-chain randomness • Instant payouts
                </p>
            </footer>

            {/* Win Modal */}
            {shouldShowModal && lastRoll?.bingoType && (
                <WinModal
                    bingoType={lastRoll.bingoType}
                    rollsCount={lastRoll.rollsCount}
                    prize={potentialPayout?.potentialPayout}
                    onNewGame={handleNewGameFromModal}
                    onClose={() => setShowWinModal(false)}
                    onClaim={potentialPayout ? async () => {
                        await claimPrize();
                        await refreshState();
                        setShowWinModal(false);
                    } : undefined}
                />
            )}
        </div>
    );
}

export default App;
