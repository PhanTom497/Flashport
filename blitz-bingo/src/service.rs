// FlashPort Phase 1+2: GraphQL Service
// Provides read-only queries and mutation scheduling with balance info

#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;

use async_graphql::{EmptySubscription, Object, Schema};
use blitz_bingo::{
    BingoCard, FlashportAbi, GameSession, Operation, PlayerBalance, 
    ENTRY_FEE, ROLL_COST,
};
use linera_sdk::{
    linera_base_types::{Amount, ChainId, WithServiceAbi},
    views::View,
    Service, ServiceRuntime,
};

use self::state::FlashportState;

/// The FlashPort service handler
pub struct FlashportService {
    state: Arc<FlashportState>,
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(FlashportService);

impl WithServiceAbi for FlashportService {
    type Abi = FlashportAbi;
}

impl Service for FlashportService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = FlashportState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        FlashportService {
            state: Arc::new(state),
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, query: Self::Query) -> Self::QueryResponse {
        Schema::build(
            QueryRoot {
                state: self.state.clone(),
            },
            MutationRoot {
                runtime: self.runtime.clone(),
            },
            EmptySubscription,
        )
        .finish()
        .execute(query)
        .await
    }
}

// =============================================================================
// QUERY ROOT - Read-only access to state
// =============================================================================

struct QueryRoot {
    state: Arc<FlashportState>,
}

#[Object]
impl QueryRoot {
    /// Get current session status
    async fn session(&self) -> Option<GameSession> {
        self.state.active_session.get().clone()
    }

    /// Check if a session exists
    async fn has_session(&self) -> bool {
        self.state.active_session.get().is_some()
    }

    /// Get the current active bingo card
    async fn current_card(&self) -> Option<BingoCard> {
        self.state.current_card.get().clone()
    }

    /// Get all numbers drawn in the current game
    async fn drawn_numbers(&self) -> Vec<u8> {
        self.state.drawn_numbers.get().clone()
    }

    /// Get total games played
    async fn total_games(&self) -> u64 {
        *self.state.total_games.get()
    }

    /// Get total wins
    async fn total_wins(&self) -> u64 {
        *self.state.total_wins.get()
    }

    /// Get the number of rolls in history
    async fn roll_history_count(&self) -> usize {
        self.state.roll_history.count()
    }

    /// Get the most recent roll (last roll made)
    async fn last_roll(&self) -> Option<LastRollResult> {
        let count = self.state.roll_history.count();
        if count == 0 {
            return None;
        }
        
        // Get the last item in the queue (most recent roll)
        if let Some(record) = self.state.roll_history.back().await.ok().flatten() {
            Some(LastRollResult {
                dice: record.dice.to_vec(),
                sum: record.sum,
                matched: record.matched,
                timestamp_micros: record.timestamp_micros,
                game_over: *self.state.has_unclaimed_prize.get(),
                is_lucky: record.is_lucky,
            })
        } else {
            None
        }
    }

    /// Get win rate as percentage (0-100)
    async fn win_rate(&self) -> f64 {
        let total = *self.state.total_games.get();
        let wins = *self.state.total_wins.get();
        if total == 0 {
            0.0
        } else {
            (wins as f64 / total as f64) * 100.0
        }
    }

    // === Token Economics Queries ===
    
    /// Get player's current balance info
    async fn player_balance(&self) -> PlayerBalance {
        PlayerBalance {
            available_atto: format!("{}", u128::from(*self.state.player_balance.get())),
            total_deposited_atto: format!("{}", u128::from(*self.state.total_deposited.get())),
            total_won_atto: format!("{}", u128::from(*self.state.total_won.get())),
            total_spent_atto: format!("{}", u128::from(*self.state.total_spent.get())),
        }
    }
    
    /// Get current prize pool amount (in atto)
    async fn current_prize_pool(&self) -> String {
        format!("{}", u128::from(*self.state.current_prize_pool.get()))
    }
    
    /// Check if there's an unclaimed prize
    async fn has_unclaimed_prize(&self) -> bool {
        *self.state.has_unclaimed_prize.get()
    }
    
    /// Get the entry fee in atto LINERA
    async fn entry_fee(&self) -> String {
        format!("{}", ENTRY_FEE)
    }
    
    /// Get the roll cost in atto LINERA
    async fn roll_cost(&self) -> String {
        format!("{}", ROLL_COST)
    }
    
    /// Get entry fee in human-readable LINERA
    async fn entry_fee_linera(&self) -> f64 {
        ENTRY_FEE as f64 / 1e18
    }
    
    /// Get roll cost in human-readable LINERA
    async fn roll_cost_linera(&self) -> f64 {
        ROLL_COST as f64 / 1e18
    }
    
    /// Get the current potential payout if player wins now
    async fn potential_payout(&self) -> Option<PotentialPayout> {
        self.calculate_potential_payout()
    }

    /// Get statistics summary
    async fn stats(&self) -> GameStats {
        let total_games = *self.state.total_games.get();
        let total_wins = *self.state.total_wins.get();
        let current_rolls = self
            .state
            .current_card
            .get()
            .as_ref()
            .map(|c| c.rolls_count)
            .unwrap_or(0);
        let balance = *self.state.player_balance.get();

        GameStats {
            total_games,
            total_wins,
            current_game_rolls: current_rolls,
            win_rate: if total_games == 0 {
                0.0
            } else {
                (total_wins as f64 / total_games as f64) * 100.0
            },
            balance_atto: format!("{}", u128::from(balance)),
            balance_linera: u128::from(balance) as f64 / 1e18,
        }
    }


    }


/// Game statistics summary with balance
#[derive(async_graphql::SimpleObject)]
struct GameStats {
    total_games: u64,
    total_wins: u64,
    current_game_rolls: u32,
    win_rate: f64,
    balance_atto: String,
    balance_linera: f64,
}

/// Last roll result for display
#[derive(async_graphql::SimpleObject)]
struct LastRollResult {
    dice: Vec<u8>,
    sum: u8,
    matched: bool,
    timestamp_micros: u64,
    game_over: bool,
    is_lucky: bool,
}

/// Potential payout info for current game
#[derive(async_graphql::SimpleObject)]
struct PotentialPayout {
    bet_amount_atto: String,
    bet_amount_linera: f64,
    rolls_count: u32,
    multiplier: String,
    potential_payout_atto: String,
    potential_payout_linera: f64,
    tier_name: String,
}

impl QueryRoot {
    /// Helper: Get multiplier based on roll count (mirrors contract logic)
    fn get_multiplier(rolls: u32) -> (u32, u32, String, String) {
        // (numerator, denominator, display, tier_name)
        match rolls {
            0..=9 => (10, 1, "10x".to_string(), "LEGENDARY".to_string()),
            10..=14 => (5, 1, "5x".to_string(), "EPIC".to_string()),
            15..=19 => (3, 1, "3x".to_string(), "RARE".to_string()),
            20..=24 => (2, 1, "2x".to_string(), "GOOD".to_string()),
            25..=34 => (12, 10, "1.2x".to_string(), "NORMAL".to_string()),
            35..=44 => (8, 10, "0.8x".to_string(), "REDUCED".to_string()),
            _ => (2, 10, "0.2x".to_string(), "MINIMAL".to_string()),
        }
    }
    
    /// Get the current potential payout if player wins now
    fn calculate_potential_payout(&self) -> Option<PotentialPayout> {
        let card = self.state.current_card.get().as_ref()?;
        
        let bet_amount_atto: u128 = card.bet_amount_atto.parse().unwrap_or(0);
        if bet_amount_atto == 0 {
            return None;
        }
        
        let (num, denom, multiplier, tier_name) = Self::get_multiplier(card.rolls_count);
        let payout_atto = bet_amount_atto.saturating_mul(num as u128) / (denom as u128);
        
        Some(PotentialPayout {
            bet_amount_atto: bet_amount_atto.to_string(),
            bet_amount_linera: bet_amount_atto as f64 / 1e18,
            rolls_count: card.rolls_count,
            multiplier,
            potential_payout_atto: payout_atto.to_string(),
            potential_payout_linera: payout_atto as f64 / 1e18,
            tier_name,
        })
    }
}

// =============================================================================
// MUTATION ROOT - Schedule operations
// =============================================================================

struct MutationRoot {
    runtime: Arc<ServiceRuntime<FlashportService>>,
}

#[Object]
impl MutationRoot {
    /// Start a new session
    async fn start_session(&self, expires_in_secs: u64) -> bool {
        let op = Operation::StartSession { expires_in_secs };
        self.runtime.schedule_operation(&op);
        true
    }

    /// End the current session
    async fn end_session(&self) -> bool {
        self.runtime.schedule_operation(&Operation::EndSession);
        true
    }

    /// Deposit funds (specify amount in LINERA)
    async fn deposit(&self, amount_linera: f64) -> bool {
        // Convert LINERA to atto (1 LINERA = 10^18 atto)
        let amount_atto = (amount_linera * 1e18) as u128;
        self.runtime.schedule_operation(&Operation::Deposit { amount_atto });
        true
    }
    
    /// Withdraw funds
    async fn withdraw(&self, amount_atto: String) -> bool {
        let amount = amount_atto.parse::<u128>().unwrap_or(0);
        let op = Operation::Withdraw {
            amount: Amount::from_attos(amount),
        };
        self.runtime.schedule_operation(&op);
        true
    }

    /// Start a new game with bet amount (1-100 LINERA)
    async fn new_game(&self, bet_amount_linera: f64) -> bool {
        // Convert LINERA to atto (1 LINERA = 10^18 atto)
        let bet_amount_atto = (bet_amount_linera * 1e18) as u128;
        let op = Operation::NewGame { bet_amount_atto };
        self.runtime.schedule_operation(&op);
        true
    }

    /// Roll 4 dice and match on the current card (costs 0.1 LINERA)
    async fn roll_and_match(&self) -> bool {
        self.runtime.schedule_operation(&Operation::RollAndMatch);
        true
    }

    /// Claim prize after winning
    async fn claim_prize(&self) -> bool {
        self.runtime.schedule_operation(&Operation::ClaimPrize);
        true
    }

    /// Auto-roll multiple times (schedules N roll operations)
    async fn auto_roll(&self, count: u32) -> u32 {
        let count = count.min(100); // Cap at 100 rolls
        for _ in 0..count {
            self.runtime.schedule_operation(&Operation::RollAndMatch);
        }
        count
    }
}
    


#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use async_graphql::{Request, Response, Value};
    use futures::FutureExt as _;
    use linera_sdk::{util::BlockingWait, views::View, Service, ServiceRuntime};
    use serde_json::json;

    use super::{FlashportService, FlashportState};

    #[test]
    fn test_query_stats() {
        let runtime = Arc::new(ServiceRuntime::<FlashportService>::new());
        let state = FlashportState::load(runtime.root_view_storage_context())
            .blocking_wait()
            .expect("Failed to load state");

        let service = FlashportService {
            state: Arc::new(state),
            runtime,
        };

        let request = Request::new("{ totalGames totalWins }");

        let response = service
            .handle_query(request)
            .now_or_never()
            .expect("Query should not await");

        let expected = Response::new(
            Value::from_json(json!({
                "totalGames": 0,
                "totalWins": 0
            }))
            .unwrap(),
        );

        assert_eq!(response, expected);
    }

    #[test]
    fn test_query_fees() {
        let runtime = Arc::new(ServiceRuntime::<FlashportService>::new());
        let state = FlashportState::load(runtime.root_view_storage_context())
            .blocking_wait()
            .expect("Failed to load state");

        let service = FlashportService {
            state: Arc::new(state),
            runtime,
        };

        let request = Request::new("{ entryFeeLinera rollCostLinera }");

        let response = service
            .handle_query(request)
            .now_or_never()
            .expect("Query should not await");

        // Entry fee should be 5.0 LINERA, roll cost 0.1 LINERA
        let expected = Response::new(
            Value::from_json(json!({
                "entryFeeLinera": 5.0,
                "rollCostLinera": 0.1
            }))
            .unwrap(),
        );

        assert_eq!(response, expected);
    }
}
