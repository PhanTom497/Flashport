// FlashPort Phase 1+2: Application State
// Uses linera-views for persistent storage with token tracking

use linera_sdk::linera_base_types::Amount;
use linera_sdk::views::{linera_views, MapView, QueueView, RegisterView, RootView, ViewStorageContext};

use flashport::{BingoCard, GameSession, PlayerBalance, RollRecord};

/// The complete FlashPort application state
#[derive(RootView, async_graphql::SimpleObject)]
#[view(context = ViewStorageContext)]
pub struct FlashportState {
    // === Session Management ===
    /// Current active session (None if not started)
    pub active_session: RegisterView<Option<GameSession>>,
    /// Counter for generating unique session IDs
    pub session_counter: RegisterView<u64>,

    // === Dice-Bingo Game State ===
    /// The user's current active bingo card
    pub current_card: RegisterView<Option<BingoCard>>,
    /// Counter for generating unique game IDs
    pub game_counter: RegisterView<u64>,
    /// All numbers drawn in the current game
    pub drawn_numbers: RegisterView<Vec<u8>>,
    /// Whether current game has unclaimed prize
    pub has_unclaimed_prize: RegisterView<bool>,

    // === Token Economics ===
    /// Player's available balance (deposited - spent + won)
    pub player_balance: RegisterView<Amount>,
    /// Total deposited by player
    pub total_deposited: RegisterView<Amount>,
    /// Total won by player
    pub total_won: RegisterView<Amount>,
    /// Total spent on fees by player
    pub total_spent: RegisterView<Amount>,
    /// Current prize pool for active bingo game
    pub current_prize_pool: RegisterView<Amount>,

    // === Dice-Bingo Statistics ===
    /// Total games played
    pub total_games: RegisterView<u64>,
    /// Total games won (bingo achieved)
    pub total_wins: RegisterView<u64>,
    /// History of recent roll results (keeps last 50)
    pub roll_history: QueueView<RollRecord>,
}

