// FlashPort Phase 1: Dice-Bingo Gaming Engine
// ABI Definitions with Token Economics and Cross-Chain Messaging

use async_graphql::{Enum, InputObject, Request, Response, SimpleObject};
use linera_sdk::linera_base_types::{AccountOwner, Amount, ChainId, ContractAbi, ServiceAbi};
use serde::{Deserialize, Serialize};

/// Main ABI type for the FlashPort application
pub struct FlashportAbi;

// === Configuration Constants ===
/// Minimum bet amount (1 LINERA = 1_000_000_000_000_000_000 atto)
pub const MIN_BET: u128 = 1_000_000_000_000_000_000;
/// Maximum bet amount (100 LINERA)
pub const MAX_BET: u128 = 100_000_000_000_000_000_000;
/// Cost per roll (0.05 LINERA = 50_000_000_000_000_000 atto)
pub const ROLL_COST: u128 = 50_000_000_000_000_000;

// Legacy constants for backward compatibility
/// Entry fee (deprecated - now using bet_amount)
pub const ENTRY_FEE: u128 = 5_000_000_000_000_000_000;
/// Prize multiplier (deprecated - now using tiered system)
pub const PRIZE_MULTIPLIER: u128 = 2;

// === Operations ===

/// All possible operations that can be executed on the contract
#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum Operation {
    /// Start a new game session (requires wallet signature)
    /// After this, subsequent RollAndMatch operations are authorized
    StartSession {
        /// How long the session should last (in seconds)
        expires_in_secs: u64,
    },

    /// End the current session
    EndSession,

    /// Start a new bingo game with a bet amount
    /// Requires bet_amount between MIN_BET (1 LINERA) and MAX_BET (100 LINERA)
    /// The bet is held in escrow until game ends
    NewGame {
        /// Bet amount in atto LINERA (1 LINERA = 10^18 atto)
        bet_amount_atto: u128,
    },

    /// Roll 4 dice and mark the sum on the card
    /// Requires payment of ROLL_COST (0.1 LINERA)
    /// This is the main game operation - atomic: roll -> sum -> mark -> check win
    RollAndMatch,
    
    /// Claim winnings after a bingo
    ClaimPrize,
    
    // === Dice-Bingo Operations ===
    
    /// Deposit funds to play with a specified amount
    Deposit {
        /// Amount to deposit in atto LINERA (1 LINERA = 10^18 atto)
        amount_atto: u128,
    },
    
    /// Withdraw available balance
    Withdraw {
        amount: Amount,
    },
}

// === Response Types ===

/// Response returned from contract operations
#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum OperationResponse {
    /// Session started successfully
    SessionStarted {
        session_id: u64,
        expires_at_micros: u64,
    },

    /// Session ended
    SessionEnded,

    /// New game started with a fresh card
    GameStarted {
        game_id: u64,
        card: BingoCard,
        entry_fee_paid: String,
        prize_pool: String,
    },

    /// Result of a roll operation
    RollResult {
        /// The four dice values (1-6 each)
        dice: [u8; 4],
        /// Sum of the dice (4-24)
        sum: u8,
        /// Whether the sum was found and marked on the card
        matched: bool,
        /// Position where the number was marked (row, col) if matched
        match_row: Option<u8>,
        match_col: Option<u8>,
        /// Type of bingo achieved, if any
        bingo_type: Option<BingoType>,
        /// Whether the game is over (bingo achieved)
        game_over: bool,
        /// Current roll count for this game
        rolls_count: u32,
        /// Roll fee paid
        roll_fee_paid: String,
        /// Total spent on rolls this game
        total_roll_fees: String,
        /// Whether this was a "lucky" match (multiple numbers matched)
        is_lucky: bool,
    },
    
    /// Prize claimed successfully
    PrizeClaimed {
        /// Original bet amount
        bet_amount: String,
        /// Number of rolls to win
        rolls_count: u32,
        /// Multiplier applied (as string like "10x", "1.2x")
        multiplier_display: String,
        /// Calculated payout amount
        payout_amount: String,
        /// New player balance
        new_balance: String,
    },
    
    /// Deposit received
    DepositReceived {
        amount: String,
        new_balance: String,
    },
    
    /// Withdrawal processed
    WithdrawalProcessed {
        amount: String,
        remaining_balance: String,
    },

    /// Error response
    Error {
        message: String,
    },
}

// === Bingo Card ===

/// A 5x5 Bingo card with numbers from 4-24
#[derive(Debug, Clone, Default, Deserialize, Serialize, SimpleObject)]
pub struct BingoCard {
    /// Unique identifier for this card
    pub id: u64,
    /// 5x5 grid of numbers (4-24, 0 = FREE space)
    /// Stored as a flat array for simplicity: row-major order
    pub numbers: [u8; 25],
    /// Which cells are marked (matched or FREE)
    pub marked: [bool; 25],
    /// Number of rolls made on this card
    pub rolls_count: u32,
    /// The player's bet amount for this game (in atto)
    pub bet_amount_atto: String,
    /// Total LINERA spent on rolls for this game (in atto)
    pub total_roll_fees_atto: String,
    /// Whether prize has been claimed
    pub prize_claimed: bool,
}

impl BingoCard {
    /// Get the number at a specific position
    pub fn get_number(&self, row: usize, col: usize) -> u8 {
        self.numbers[row * 5 + col]
    }

    /// Check if a cell is marked
    pub fn is_marked(&self, row: usize, col: usize) -> bool {
        self.marked[row * 5 + col]
    }

    /// Mark a cell
    pub fn mark(&mut self, row: usize, col: usize) {
        self.marked[row * 5 + col] = true;
    }
}

// === Win Types ===

/// Types of bingo wins
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Enum)]
pub enum BingoType {
    /// Completed a horizontal row (index 0-4)
    Row0,
    Row1,
    Row2,
    Row3,
    Row4,
    /// Completed a vertical column (index 0-4)
    Col0,
    Col1,
    Col2,
    Col3,
    Col4,
    /// Completed main diagonal (top-left to bottom-right)
    DiagonalMain,
    /// Completed anti-diagonal (top-right to bottom-left)
    DiagonalAnti,
    /// Full card (blackout) - all cells marked
    FullCard,
}

// === Session ===

/// Game session for authorizing rapid operations
#[derive(Debug, Clone, Default, Deserialize, Serialize, SimpleObject)]
pub struct GameSession {
    /// Unique session identifier
    pub session_id: u64,
    /// When the session was created (microseconds since epoch)
    pub created_at_micros: u64,
    /// When the session expires (microseconds since epoch)
    pub expires_at_micros: u64,
    /// Total operations performed in this session
    pub operations_count: u64,
}

// === Roll Record ===

/// Record of a single dice roll
#[derive(Debug, Clone, Default, Deserialize, Serialize, SimpleObject)]
pub struct RollRecord {
    /// The four dice values
    pub dice: [u8; 4],
    /// Sum of the dice
    pub sum: u8,
    /// Whether it matched a number on the card
    pub matched: bool,
    /// Timestamp in microseconds
    pub timestamp_micros: u64,
    /// Roll fee paid (in atto LINERA)
    pub fee_paid_atto: String,
    /// Whether this was a lucky match
    pub is_lucky: bool,
}

// === Player Balance ===

/// Player's in-game balance and stats
#[derive(Debug, Clone, Default, Deserialize, Serialize, SimpleObject)]
pub struct PlayerBalance {
    /// Available balance (in atto LINERA)
    pub available_atto: String,
    /// Total deposited (in atto LINERA)
    pub total_deposited_atto: String,
    /// Total won (in atto LINERA)
    pub total_won_atto: String,
    /// Total spent on fees (in atto LINERA)
    pub total_spent_atto: String,
}



// === ABI Implementation ===

impl ContractAbi for FlashportAbi {
    type Operation = Operation;
    type Response = OperationResponse;
}

impl ServiceAbi for FlashportAbi {
    type Query = Request;
    type QueryResponse = Response;
}

