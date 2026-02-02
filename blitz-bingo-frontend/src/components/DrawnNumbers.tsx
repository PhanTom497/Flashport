interface DrawnNumbersProps {
    numbers: number[];
}

export function DrawnNumbers({ numbers }: DrawnNumbersProps) {
    // Numbers range from 4-24
    const allPossible = Array.from({ length: 21 }, (_, i) => i + 4);

    return (
        <div className="game-card">
            <h3 className="text-lg font-bold text-white mb-3">Drawn Numbers</h3>

            <div className="flex flex-wrap gap-2">
                {allPossible.map(num => {
                    const isDrawn = numbers.includes(num);
                    return (
                        <div
                            key={num}
                            className={`
                w-8 h-8 rounded-lg flex items-center justify-center
                text-sm font-bold transition-all duration-200
                ${isDrawn
                                    ? 'bg-green text-[var(--text-dark)]'
                                    : 'bg-[var(--bg-cell)] text-muted'
                                }
              `}
                        >
                            {num}
                        </div>
                    );
                })}
            </div>

            <p className="text-secondary text-sm mt-3">
                {numbers.length} of 21 numbers drawn
            </p>
        </div>
    );
}
