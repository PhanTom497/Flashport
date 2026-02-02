// Asset Faucets Component - $FLASH Token Management
import { useState } from 'react';
import { motion } from 'framer-motion';
import { MIN_BET_LINERA, MAX_BET_LINERA } from '../hooks/useLinera';

interface AssetFaucetsProps {
    lineraBalance: number;
    blitzBalance: number;
    onMint: (amount: number) => Promise<void>;
    isLoading: boolean;
    chainId: string | null;
}

// Quick mint amounts
const QUICK_AMOUNTS = [10, 25, 50, 100];

export function AssetFaucets({
    lineraBalance,
    blitzBalance,
    onMint,
    isLoading,
    chainId
}: AssetFaucetsProps) {
    const [mintAmount, setMintAmount] = useState(10);

    const handleMint = async () => {
        if (mintAmount > 0 && mintAmount <= lineraBalance) {
            await onMint(mintAmount);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <motion.div
                className="text-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <span className="inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30">
                    💎 Token Management
                </span>
                <h2 className="text-4xl font-black text-white mt-4">
                    Asset <span className="text-blitz">Faucets</span>
                </h2>
                <p className="text-secondary mt-2 max-w-lg mx-auto">
                    Convert Linera tokens to $BLITZ for gameplay. Instant, seamless, on-chain.
                </p>
            </motion.div>

            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Linera Native Card */}
                <motion.div
                    className="glass-card p-6 relative overflow-hidden"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    {/* Background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <span className="text-white text-2xl">◎</span>
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">Linera Native</h3>
                                <p className="text-xs text-blue-400 uppercase tracking-wider">L1 Blockchain</p>
                            </div>
                        </div>

                        <p className="text-xs text-secondary uppercase tracking-wider mb-1">
                            Current Balance
                        </p>
                        <motion.p
                            className="text-4xl font-black text-white tabular-nums"
                            key={lineraBalance}
                            initial={{ scale: 1.1 }}
                            animate={{ scale: 1 }}
                        >
                            {lineraBalance.toFixed(4)}
                        </motion.p>
                        <p className="text-blue-400 text-sm font-semibold mt-1">LINERA</p>

                        {chainId && (
                            <div className="mt-5 pt-4 border-t border-white/10">
                                <p className="text-xs text-secondary">Connected Chain</p>
                                <p className="text-xs text-white/70 font-mono truncate" title={chainId}>
                                    {chainId.slice(0, 16)}...{chainId.slice(-8)}
                                </p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* $FLASH Token Card */}
                <motion.div
                    className="glass-card-glow p-6 relative overflow-hidden"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    {/* Background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-amber-500/10 pointer-events-none" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                                <span className="text-white text-xl font-black">⚡</span>
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">$BLITZ</h3>
                                <p className="text-xs text-blitz uppercase tracking-wider">Game Tokens</p>
                            </div>
                        </div>

                        <p className="text-xs text-secondary uppercase tracking-wider mb-1">
                            Token Balance
                        </p>
                        <motion.p
                            className="text-4xl font-black blitz-balance tabular-nums"
                            key={blitzBalance}
                            initial={{ scale: 1.1 }}
                            animate={{ scale: 1 }}
                        >
                            {blitzBalance.toFixed(2)}
                        </motion.p>
                        <p className="text-blitz text-sm font-semibold mt-1">$BLITZ</p>

                        {/* Mint Section */}
                        <div className="mt-5 pt-4 border-t border-white/10 space-y-4">
                            <p className="text-xs text-secondary uppercase tracking-wider">
                                Mint $BLITZ Tokens
                            </p>

                            {/* Quick amount buttons */}
                            <div className="flex gap-2">
                                {QUICK_AMOUNTS.map(amount => (
                                    <motion.button
                                        key={amount}
                                        onClick={() => setMintAmount(amount)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all
                                            ${mintAmount === amount
                                                ? 'bg-gradient-to-r from-purple-500 to-amber-500 text-white'
                                                : 'bg-white/5 text-secondary hover:bg-white/10 border border-white/10'
                                            }`}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        {amount}
                                    </motion.button>
                                ))}
                            </div>

                            {/* Custom amount input */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={MIN_BET_LINERA}
                                    max={Math.min(MAX_BET_LINERA * 10, Math.floor(lineraBalance))}
                                    value={mintAmount}
                                    onChange={(e) => setMintAmount(Math.max(0, Number(e.target.value)))}
                                    className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white text-lg font-bold focus:border-blitz focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                                    placeholder="Amount"
                                />
                                <span className="text-secondary text-sm font-semibold">LINERA</span>
                            </div>

                            <motion.button
                                onClick={handleMint}
                                disabled={isLoading || mintAmount <= 0 || mintAmount > lineraBalance}
                                className="w-full py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden relative"
                                style={{
                                    background: 'linear-gradient(135deg, #8B5CF6 0%, #F59E0B 100%)',
                                }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <span className="relative z-10 flex items-center justify-center gap-2 text-white">
                                    {isLoading ? (
                                        <>
                                            <motion.span
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                            >
                                                ⚡
                                            </motion.span>
                                            MINTING...
                                        </>
                                    ) : (
                                        <>
                                            ⚡ MINT {mintAmount} $BLITZ
                                        </>
                                    )}
                                </span>
                            </motion.button>

                            <p className="text-xs text-center text-secondary">
                                1 LINERA = 1 $BLITZ • Instant conversion
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Info Banner */}
            <motion.div
                className="glass-card p-5 flex items-start gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center shrink-0">
                    <span className="text-amber-400 text-lg">💡</span>
                </div>
                <div>
                    <p className="text-white font-bold mb-1">How $BLITZ Works</p>
                    <p className="text-secondary text-sm leading-relaxed">
                        Convert your Linera tokens to $BLITZ to play games. All winnings are paid in $BLITZ
                        and can be withdrawn back to Linera at any time. Transactions are instant and verified on-chain.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
