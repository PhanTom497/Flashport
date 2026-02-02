import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BingoType } from '../types/game';

interface WinModalProps {
    bingoType: BingoType;
    rollsCount: number;
    prize?: number;
    onNewGame: () => void;
    onClose: () => void;
    onClaim?: () => void;
}

function getBingoLabel(type: BingoType): string {
    if (type.startsWith('Row')) return `Row ${parseInt(type.replace('Row', '')) + 1}`;
    if (type.startsWith('Col')) return `Column ${parseInt(type.replace('Col', '')) + 1}`;
    if (type === 'DiagonalMain') return 'Main Diagonal';
    if (type === 'DiagonalAnti') return 'Anti Diagonal';
    if (type === 'FullCard') return 'FULL CARD!';
    return type;
}

function getMultiplierTier(rolls: number): { name: string; color: string } {
    if (rolls <= 9) return { name: 'LEGENDARY', color: 'from-yellow-400 to-amber-500' };
    if (rolls <= 14) return { name: 'EPIC', color: 'from-purple-400 to-pink-500' };
    if (rolls <= 19) return { name: 'RARE', color: 'from-blue-400 to-cyan-500' };
    if (rolls <= 24) return { name: 'GOOD', color: 'from-green-400 to-emerald-500' };
    return { name: 'STANDARD', color: 'from-gray-400 to-gray-500' };
}

// Gold $FLASH particle for winning shower
function GoldParticle({ delay, x, duration, symbolIndex }: { delay: number; x: number; duration: number; symbolIndex: number }) {
    const symbols = ['💰', '⚡', '🪙', '✨', '💎'];
    const symbol = symbols[symbolIndex % symbols.length];

    return (
        <motion.div
            className="gold-shower-particle"
            style={{ left: `${x}%` }}
            initial={{ y: -50, rotate: 0, opacity: 1, scale: 1 }}
            animate={{
                y: '110vh',
                rotate: 720,
                opacity: 0,
                scale: 0.5,
            }}
            transition={{
                duration,
                delay,
                ease: 'linear',
            }}
        >
            {symbol}
        </motion.div>
    );
}

// Seeded random number generator for stable particle generation
function seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

export function WinModal({ bingoType, rollsCount, prize, onNewGame, onClose, onClaim }: WinModalProps) {
    // Generate gold shower particles using useMemo with stable seeds
    const goldParticles = useMemo(() =>
        Array.from({ length: 40 }, (_, i) => ({
            id: i,
            delay: seededRandom(i * 3) * 1,
            x: seededRandom(i * 3 + 1) * 100,
            duration: 2.5 + seededRandom(i * 3 + 2) * 1.5,
            symbolIndex: i,
        })), []);

    const tier = getMultiplierTier(rollsCount);

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                {/* Gold Shower Effect */}
                {goldParticles.map(({ id, delay, x, duration, symbolIndex }) => (
                    <GoldParticle key={id} delay={delay} x={x} duration={duration} symbolIndex={symbolIndex} />
                ))}

                {/* Modal */}
                <motion.div
                    className="glass-card-glow p-8 max-w-md w-full mx-4 text-center relative overflow-hidden"
                    style={{
                        boxShadow: '0 0 80px rgba(245, 158, 11, 0.4), 0 0 120px rgba(139, 92, 246, 0.2)'
                    }}
                    initial={{ scale: 0.7, y: 50, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.7, y: 50, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Background glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-purple-500/10 pointer-events-none" />

                    {/* Celebration Emoji */}
                    <motion.div
                        className="text-7xl mb-4 relative z-10"
                        animate={{
                            scale: [1, 1.3, 1],
                            rotate: [0, 15, -15, 0],
                        }}
                        transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            repeatDelay: 0.8,
                        }}
                    >
                        🏆
                    </motion.div>

                    {/* BINGO! Text */}
                    <motion.h1
                        className="text-5xl font-black mb-3 relative z-10"
                        style={{
                            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            textShadow: '0 0 40px rgba(255, 215, 0, 0.5)',
                        }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 12, delay: 0.1 }}
                    >
                        BINGO!
                    </motion.h1>

                    {/* Tier Badge */}
                    <motion.div
                        className={`inline-block px-4 py-1 rounded-full text-sm font-bold text-white mb-4 bg-gradient-to-r ${tier.color}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        {tier.name}
                    </motion.div>

                    {/* Win Type */}
                    <p className="text-xl font-bold text-green-400 mb-4 relative z-10">
                        {getBingoLabel(bingoType)}
                    </p>

                    {/* Prize Display */}
                    {prize && (
                        <motion.div
                            className="bg-gradient-to-r from-purple-900/50 via-black/30 to-amber-900/50 rounded-2xl p-5 mb-5 border border-gold/30"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            <p className="text-xs text-secondary uppercase tracking-widest mb-2">You Won</p>
                            <motion.p
                                className="text-4xl font-black"
                                style={{
                                    background: 'linear-gradient(135deg, #A78BFA 0%, #F59E0B 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            >
                                +{prize.toFixed(2)} $FLASH
                            </motion.p>
                        </motion.div>
                    )}

                    {/* Stats */}
                    <div className="glass-card p-4 mb-6 relative z-10">
                        <div className="flex justify-between items-center">
                            <span className="text-secondary">Completed in</span>
                            <span className="text-2xl font-black text-flash">{rollsCount} rolls</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 relative z-10">
                        {onClaim && (
                            <motion.button
                                onClick={onClaim}
                                className="flex-1 py-4 px-6 rounded-xl font-bold text-black text-lg"
                                style={{
                                    background: 'linear-gradient(135deg, #FFD700 0%, #F59E0B 100%)',
                                    boxShadow: '0 0 30px rgba(245, 158, 11, 0.5)',
                                }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                💰 Claim Prize
                            </motion.button>
                        )}
                        <motion.button
                            onClick={onNewGame}
                            className="btn-primary flex-1 py-4"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            🎲 Play Again
                        </motion.button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
