import type { GameSession } from '../types/game';

interface SessionIndicatorProps {
    session: GameSession | null;
    onStartSession: () => void;
    onEndSession: () => void;
}

function formatTimeRemaining(expiresAtMicros: number): string {
    const now = Date.now() * 1000;
    const remaining = expiresAtMicros - now;

    if (remaining <= 0) return 'Expired';

    const seconds = Math.floor(remaining / 1000000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}

export function SessionIndicator({ session, onStartSession, onEndSession }: SessionIndicatorProps) {
    if (!session) {
        return (
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red" />
                    <span className="text-secondary">No Session</span>
                </div>
                <button
                    onClick={onStartSession}
                    className="btn-primary py-2 px-4 text-sm"
                >
                    Start Session
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green session-active" />
                <span className="text-green font-medium">Session Active</span>
            </div>
            <div className="text-secondary text-sm">
                <span className="text-muted">Expires in: </span>
                <span className="text-white font-mono">
                    {formatTimeRemaining(session.expiresAtMicros)}
                </span>
            </div>
            <div className="text-secondary text-sm">
                <span className="text-muted">Ops: </span>
                <span className="text-gold font-bold">{session.operationsCount}</span>
            </div>
            <button
                onClick={onEndSession}
                className="btn-secondary py-1 px-3 text-xs"
            >
                End
            </button>
        </div>
    );
}
