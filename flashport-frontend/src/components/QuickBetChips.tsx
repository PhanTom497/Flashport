import { motion } from 'framer-motion';

interface QuickBetChipsProps {
    selectedAmount: number;
    onSelect: (amount: number) => void;
    maxBet: number;
    disabled?: boolean;
}

const CHIP_VALUES = [1, 5, 10, 50, 100];

// Chip colors based on value
const chipColors: Record<number, { bg: string; border: string; glow: string }> = {
    1: { bg: 'from-slate-600 to-slate-700', border: 'border-slate-400', glow: 'rgba(148, 163, 184, 0.3)' },
    5: { bg: 'from-blue-600 to-blue-700', border: 'border-blue-400', glow: 'rgba(59, 130, 246, 0.4)' },
    10: { bg: 'from-green-600 to-green-700', border: 'border-green-400', glow: 'rgba(34, 197, 94, 0.4)' },
    50: { bg: 'from-amber-500 to-orange-600', border: 'border-amber-400', glow: 'rgba(245, 158, 11, 0.4)' },
    100: { bg: 'from-purple-600 to-pink-600', border: 'border-purple-400', glow: 'rgba(168, 85, 247, 0.5)' },
};

export function QuickBetChips({ selectedAmount, onSelect, maxBet, disabled }: QuickBetChipsProps) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-xs text-secondary uppercase tracking-wider">Quick Bet</p>
                <p className="text-xs text-secondary">Max: <span className="text-flash font-bold">{maxBet}</span> $FLASH</p>
            </div>

            <div className="flex gap-2 justify-center flex-wrap">
                {CHIP_VALUES.map((value) => {
                    const isSelected = selectedAmount === value;
                    const isDisabled = disabled || value > maxBet;
                    const colors = chipColors[value];

                    return (
                        <motion.button
                            key={value}
                            onClick={() => !isDisabled && onSelect(value)}
                            disabled={isDisabled}
                            className={`
                                relative min-w-[72px] h-14 rounded-xl font-bold
                                transition-all duration-200
                                ${isDisabled
                                    ? 'opacity-40 cursor-not-allowed'
                                    : 'cursor-pointer'
                                }
                            `}
                            whileHover={!isDisabled ? { scale: 1.05, y: -3 } : {}}
                            whileTap={!isDisabled ? { scale: 0.95 } : {}}
                            style={{
                                boxShadow: isSelected
                                    ? `0 0 25px ${colors.glow}, 0 8px 20px rgba(0,0,0,0.3)`
                                    : '0 4px 12px rgba(0,0,0,0.3)'
                            }}
                        >
                            {/* Chip background */}
                            <div className={`
                                absolute inset-0 rounded-xl bg-gradient-to-b ${colors.bg}
                                border-2 ${isSelected ? 'border-white' : colors.border}
                            `} />

                            {/* Inner ring effect */}
                            <div className="absolute inset-1.5 rounded-lg border border-white/20" />

                            {/* Center pattern */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full border-2 border-white/30 flex items-center justify-center">
                                    <span className="text-white font-black text-sm drop-shadow-lg">
                                        {value}
                                    </span>
                                </div>
                            </div>

                            {/* Selected glow */}
                            {isSelected && (
                                <motion.div
                                    className="absolute -inset-1 rounded-xl"
                                    style={{ boxShadow: `0 0 30px ${colors.glow}` }}
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                />
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {/* Selected amount display */}
            <motion.div
                className="text-center py-2"
                key={selectedAmount}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400 }}
            >
                <span className="text-2xl font-black text-flash">{selectedAmount}</span>
                <span className="text-lg text-secondary ml-2">$FLASH</span>
            </motion.div>
        </div>
    );
}
