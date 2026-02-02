import { motion, AnimatePresence } from 'framer-motion';
import type { BingoCard as BingoCardType, BingoType } from '../types/game';

interface BingoCardProps {
    card: BingoCardType;
    lastMatchPos?: { row: number; col: number } | null;
    winningLine?: BingoType | null;
}

// Check if a cell is part of the winning line
function isWinningCell(row: number, col: number, winType: BingoType | null): boolean {
    if (!winType) return false;

    if (winType.startsWith('Row')) {
        const winRow = parseInt(winType.replace('Row', ''));
        return row === winRow;
    }
    if (winType.startsWith('Col')) {
        const winCol = parseInt(winType.replace('Col', ''));
        return col === winCol;
    }
    if (winType === 'DiagonalMain') {
        return row === col;
    }
    if (winType === 'DiagonalAnti') {
        return row + col === 4;
    }
    if (winType === 'FullCard') {
        return true;
    }
    return false;
}

export function BingoCard({ card, lastMatchPos, winningLine }: BingoCardProps) {
    const markedCount = card.marked.filter(Boolean).length;

    return (
        <div className="glass-card-glow p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <span className="text-lg">🎯</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Bingo Card</h2>
                        <p className="text-xs text-secondary">Match 5 in a row to win</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs text-secondary uppercase tracking-wider">Rolls</p>
                    <p className="text-2xl font-black text-flash">{card.rollsCount}</p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
                <div className="flex justify-between text-xs text-secondary mb-1">
                    <span>Progress</span>
                    <span>{markedCount}/25</span>
                </div>
                <div className="h-2 bg-[rgba(30,40,55,0.8)] rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${(markedCount / 25) * 100}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-5 gap-2.5">
                {card.numbers.map((num, idx) => {
                    const row = Math.floor(idx / 5);
                    const col = idx % 5;
                    const isMarked = card.marked[idx];
                    const isFree = idx === 12;
                    const isLastMatch = lastMatchPos?.row === row && lastMatchPos?.col === col;
                    const isWinning = isWinningCell(row, col, winningLine ?? null);

                    // Identify lucky numbers (appear more than once)
                    const isLuckyNumber = !isFree && card.numbers.filter(n => n === num).length > 1;

                    return (
                        <motion.div
                            key={idx}
                            className={`
                                aspect-square flex items-center justify-center
                                text-2xl font-black rounded-xl
                                relative overflow-hidden cursor-default
                                transition-colors duration-200
                                ${isMarked
                                    ? isFree
                                        ? 'bg-gradient-to-br from-amber-500/40 to-orange-500/40 text-amber-300 border border-amber-500/50'
                                        : 'bg-gradient-to-br from-purple-600/50 to-pink-600/50 text-purple-200 border border-purple-500/50'
                                    : 'bg-[rgba(30,40,55,0.8)] text-white/70 hover:bg-[rgba(40,55,75,0.8)] border border-white/5'
                                }
                                ${isWinning ? 'cell-winning' : ''}
                                ${isLastMatch && !winningLine ? 'cell-matched' : ''}
                                ${isLuckyNumber && !isMarked ? 'border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : ''}
                            `}
                            initial={false}
                            animate={isLastMatch && !winningLine ? {
                                scale: [1, 1.15, 1],
                                rotate: [0, -5, 5, 0]
                            } : {}}
                            transition={{ duration: 0.4, type: "spring", stiffness: 400 }}
                        >
                            {/* Glow effect for marked */}
                            {isMarked && !isFree && (
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-transparent" />
                            )}

                            {/* Lucky Clover Icon */}
                            {isLuckyNumber && (
                                <div className="absolute top-1 left-1 text-[10px] opacity-70" title="Lucky Number! Appears twice.">
                                    🍀
                                </div>
                            )}

                            {/* Number or FREE */}
                            <span className="relative z-10 drop-shadow-lg">
                                {isFree ? '⭐' : num}
                            </span>

                            {/* Electric pulse for marked cells */}
                            {isMarked && !isFree && (
                                <motion.div
                                    className="absolute inset-0 bg-purple-500/30"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: [0, 0.5, 0] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                />
                            )}

                            {/* Check mark overlay */}
                            {isMarked && !isFree && (
                                <AnimatePresence>
                                    <motion.div
                                        key="check"
                                        className="absolute top-1 right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        exit={{ scale: 0 }}
                                        transition={{ type: 'spring', damping: 15, stiffness: 400 }}
                                    >
                                        <span className="text-[10px] text-white">✓</span>
                                    </motion.div>
                                </AnimatePresence>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex gap-6 mt-5 justify-center text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-gradient-to-br from-purple-600/50 to-pink-600/50 border border-purple-500/50" />
                    <span className="text-secondary">Marked</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-500/40 to-orange-500/40 border border-amber-500/50 flex items-center justify-center text-[10px]">⭐</div>
                    <span className="text-secondary">FREE</span>
                </div>
            </div>
        </div>
    );
}
