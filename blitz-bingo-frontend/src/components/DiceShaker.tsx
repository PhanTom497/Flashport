import { motion } from 'framer-motion';

interface DiceShakerProps {
    dice: number[];
    isRolling: boolean;
    onRoll: () => void;
    disabled: boolean;
    autoRollEnabled: boolean;
    onToggleAutoRoll: () => void;
}

// Premium SVG dice face with 3D shadows
function DieFace({ value }: { value: number }) {
    const dotPositions: Record<number, [number, number][]> = {
        1: [[50, 50]],
        2: [[28, 28], [72, 72]],
        3: [[28, 28], [50, 50], [72, 72]],
        4: [[28, 28], [72, 28], [28, 72], [72, 72]],
        5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
        6: [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],
    };

    const dots = dotPositions[value] || [];

    return (
        <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* 3D shadow effect */}
            <defs>
                <filter id="dotShadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
                </filter>
                <linearGradient id="dotGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1E293B" />
                    <stop offset="100%" stopColor="#0F172A" />
                </linearGradient>
            </defs>
            {dots.map(([x, y], i) => (
                <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="11"
                    fill="url(#dotGradient)"
                    filter="url(#dotShadow)"
                />
            ))}
        </svg>
    );
}

export function DiceShaker({
    dice,
    isRolling,
    onRoll,
    disabled,
    autoRollEnabled,
    onToggleAutoRoll,
}: DiceShakerProps) {
    const sum = dice.reduce((a, b) => a + b, 0);

    return (
        <div className="glass-card p-6 flex flex-col items-center gap-5">
            {/* Title */}
            <div className="flex items-center gap-3 self-start">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <span className="text-lg">🎲</span>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Dice Shaker</h2>
                    <p className="text-xs text-secondary">Roll to match numbers</p>
                </div>
            </div>

            {/* Glass Dome Container */}
            <div className="relative">
                {/* Outer glow */}
                <div className="absolute -inset-4 bg-gradient-to-br from-purple-500/20 to-transparent rounded-3xl blur-xl" />

                {/* Glass dome */}
                <div className="relative glass-card p-6 rounded-2xl border border-white/10">
                    {/* Inner shadow effect */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                    {/* Dice row */}
                    <div className="flex gap-4 relative z-10">
                        {dice.map((value, idx) => (
                            <motion.div
                                key={idx}
                                className={`
                                    w-16 h-16 dice-3d rounded-xl
                                    flex items-center justify-center p-2
                                    ${isRolling ? 'dice-shaking' : ''}
                                `}
                                initial={false}
                                animate={!isRolling ? {
                                    rotate: (idx - 1.5) * 5,
                                    y: [0, -3, 0][idx % 3],
                                } : {}}
                                transition={{
                                    type: 'spring',
                                    stiffness: 400,
                                    damping: 20,
                                    delay: idx * 0.05
                                }}
                            >
                                {isRolling ? (
                                    <motion.span
                                        className="text-3xl font-bold text-gray-400"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }}
                                    >
                                        ?
                                    </motion.span>
                                ) : (
                                    <DieFace value={value} />
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sum Display */}
            <motion.div
                className="text-center"
                key={sum}
                initial={{ scale: 0.8, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
                <p className="text-xs text-secondary uppercase tracking-widest mb-1">Sum</p>
                <span className="sum-display">
                    {isRolling ? '...' : sum}
                </span>
            </motion.div>

            {/* Roll Button */}
            <motion.button
                onClick={onRoll}
                disabled={disabled || isRolling}
                className="btn-primary w-full max-w-xs relative overflow-hidden group"
                whileHover={!disabled && !isRolling ? { scale: 1.02 } : {}}
                whileTap={!disabled && !isRolling ? { scale: 0.98 } : {}}
            >
                <span className="relative z-10 flex items-center justify-center gap-2">
                    {isRolling ? (
                        <>
                            <motion.span
                                animate={{ rotate: 360 }}
                                transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                            >
                                🎲
                            </motion.span>
                            ROLLING...
                        </>
                    ) : (
                        <>
                            🎲 ROLL DICE
                        </>
                    )}
                </span>
            </motion.button>

            {/* Auto-Roll Toggle */}
            <motion.button
                onClick={onToggleAutoRoll}
                disabled={disabled}
                className={`
                    flex items-center gap-3 px-5 py-3 rounded-xl
                    transition-all duration-300
                    ${autoRollEnabled
                        ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                        : 'bg-white/5 border border-white/10 text-secondary hover:border-white/20'
                    }
                `}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                <div className={`
                    w-10 h-6 rounded-full p-1 transition-all duration-300
                    ${autoRollEnabled ? 'bg-green-500' : 'bg-gray-600'}
                `}>
                    <motion.div
                        className="w-4 h-4 bg-white rounded-full shadow-lg"
                        animate={{ x: autoRollEnabled ? 16 : 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                </div>
                <span className="font-semibold">
                    {autoRollEnabled ? 'Auto-Roll: ON' : 'Auto-Roll: OFF'}
                </span>
            </motion.button>
        </div>
    );
}
