import type { GameStats } from '../types/game';

interface GameStatsProps {
    stats: GameStats;
}

export function GameStatsDisplay({ stats }: GameStatsProps) {
    return (
        <div className="game-card">
            <h3 className="text-lg font-bold text-white mb-4">Statistics</h3>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-gold">{stats.totalGames}</p>
                    <p className="text-secondary text-sm">Games Played</p>
                </div>

                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-green">{stats.totalWins}</p>
                    <p className="text-secondary text-sm">Total Wins</p>
                </div>

                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-white">{stats.currentGameRolls}</p>
                    <p className="text-secondary text-sm">Current Rolls</p>
                </div>

                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-purple-400">
                        {stats.totalGames > 0 ? stats.winRate.toFixed(1) : '0'}%
                    </p>
                    <p className="text-secondary text-sm">Win Rate</p>
                </div>
            </div>
        </div>
    );
}
