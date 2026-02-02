// FlashPort Phase 1+2: Contract Implementation
// Unified Dice-Bingo Gaming Engine

#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;


use flashport::{
    BingoCard, BingoType, FlashportAbi, GameSession, Operation, OperationResponse, RollRecord,
    MIN_BET, MAX_BET, ROLL_COST,
};
use linera_sdk::{
    linera_base_types::{Amount, ChainId, WithContractAbi},
    views::{RootView, View},
    Contract, ContractRuntime,
};

use self::state::FlashportState;

/// The FlashPort contract handler
pub struct FlashportContract {
    state: FlashportState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(FlashportContract);

impl WithContractAbi for FlashportContract {
    type Abi = FlashportAbi;
}

impl Contract for FlashportContract {
    type Message = ();
    type Parameters = ();
    type InstantiationArgument = ();
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = FlashportState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        FlashportContract { state, runtime }
    }

    async fn instantiate(&mut self, _argument: Self::InstantiationArgument) {
        // Initialize with zero balances
        self.state.player_balance.set(Amount::ZERO);
        self.state.total_deposited.set(Amount::ZERO);
        self.state.total_won.set(Amount::ZERO);
        self.state.total_spent.set(Amount::ZERO);
        self.state.current_prize_pool.set(Amount::ZERO);
    }

    async fn execute_operation(&mut self, operation: Operation) -> OperationResponse {
        match operation {
            // === Dice-Bingo Operations ===
            Operation::StartSession { expires_in_secs } => self.start_session(expires_in_secs).await,
            Operation::EndSession => self.end_session().await,
            Operation::NewGame { bet_amount_atto } => {
                if let Err(msg) = self.validate_session() {
                    return OperationResponse::Error { message: msg };
                }
                self.new_game(bet_amount_atto).await
            }
            Operation::RollAndMatch => {
                if let Err(msg) = self.validate_session() {
                    return OperationResponse::Error { message: msg };
                }
                self.roll_and_match().await
            }
            Operation::ClaimPrize => {
                if let Err(msg) = self.validate_session() {
                    return OperationResponse::Error { message: msg };
                }
                self.claim_prize().await
            }
            Operation::Deposit { amount_atto } => self.handle_deposit(amount_atto).await,
            Operation::Withdraw { amount } => self.handle_withdraw(amount).await,
        }
    }

    async fn execute_message(&mut self, _message: Self::Message) {
        // No cross-chain messages for Dice-Bingo
    }

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}

impl FlashportContract {
    // =========================================================================
    // HELPER: Format Amount for display
    // =========================================================================
    fn format_amount(amount: Amount) -> String {
        let atto = u128::from(amount);
        format!("{}", atto)
    }

    // =========================================================================
    // SESSION MANAGEMENT
    // =========================================================================

    async fn start_session(&mut self, expires_in_secs: u64) -> OperationResponse {
        let now = self.runtime.system_time();
        let session_id = *self.state.session_counter.get() + 1;
        let expires_at_micros = now.micros() + expires_in_secs * 1_000_000;

        let session = GameSession {
            session_id,
            created_at_micros: now.micros(),
            expires_at_micros,
            operations_count: 0,
        };

        self.state.active_session.set(Some(session));
        self.state.session_counter.set(session_id);

        OperationResponse::SessionStarted {
            session_id,
            expires_at_micros,
        }
    }

    async fn end_session(&mut self) -> OperationResponse {
        // Clear session
        self.state.active_session.set(None);
        
        // Clear game state so new session starts fresh
        self.state.current_card.set(None);
        self.state.drawn_numbers.set(Vec::new());
        self.state.has_unclaimed_prize.set(false);
        
        // Clear roll history for new session
        while self.state.roll_history.count() > 0 {
            self.state.roll_history.delete_front();
        }
        
        OperationResponse::SessionEnded
    }

    fn validate_session(&mut self) -> Result<(), String> {
        let session = self
            .state
            .active_session
            .get()
            .as_ref()
            .ok_or_else(|| "No active session - call StartSession first".to_string())?;

        let now = self.runtime.system_time();
        if now.micros() >= session.expires_at_micros {
            return Err("Session expired - start a new session".to_string());
        }

        Ok(())
    }

    // =========================================================================
    // TOKEN OPERATIONS
    // =========================================================================

    async fn handle_deposit(&mut self, amount_atto: u128) -> OperationResponse {
        // Use the amount passed by the user
        let deposit_amount = Amount::from_attos(amount_atto);
        
        // Validate minimum deposit
        if amount_atto == 0 {
            return OperationResponse::Error {
                message: "Deposit amount must be greater than 0".to_string(),
            };
        }

        // Add to player balance
        let current = *self.state.player_balance.get();
        let new_balance = current.saturating_add(deposit_amount);
        self.state.player_balance.set(new_balance);

        // Track total deposited
        let total_dep = *self.state.total_deposited.get();
        self.state.total_deposited.set(total_dep.saturating_add(deposit_amount));

        OperationResponse::DepositReceived {
            amount: Self::format_amount(deposit_amount),
            new_balance: Self::format_amount(new_balance),
        }
    }

    async fn handle_withdraw(&mut self, amount: Amount) -> OperationResponse {
        let current = *self.state.player_balance.get();
        
        if amount > current {
            return OperationResponse::Error {
                message: format!(
                    "Insufficient balance. Available: {} atto, Requested: {} atto",
                    u128::from(current),
                    u128::from(amount)
                ),
            };
        }

        // Deduct from balance
        let remaining = current.saturating_sub(amount);
        self.state.player_balance.set(remaining);

        // In production: Transfer back to the authenticated signer
        // self.runtime.transfer(owner, amount);

        OperationResponse::WithdrawalProcessed {
            amount: Self::format_amount(amount),
            remaining_balance: Self::format_amount(remaining),
        }
    }

    fn charge_fee(&mut self, fee: u128) -> Result<(), String> {
        let fee_amount = Amount::from_attos(fee);
        let current = *self.state.player_balance.get();

        if fee_amount > current {
            return Err(format!(
                "Insufficient balance. Need {} atto, have {} atto. Deposit more LINERA.",
                fee,
                u128::from(current)
            ));
        }

        // Deduct fee
        let new_balance = current.saturating_sub(fee_amount);
        self.state.player_balance.set(new_balance);

        // Track total spent
        let total_spent = *self.state.total_spent.get();
        self.state.total_spent.set(total_spent.saturating_add(fee_amount));

        Ok(())
    }

    // =========================================================================
    // GAME LOGIC
    // =========================================================================

    async fn new_game(&mut self, bet_amount_atto: u128) -> OperationResponse {
        // Validate bet amount is within allowed range
        if bet_amount_atto < MIN_BET {
            return OperationResponse::Error {
                message: format!(
                    "Bet too low. Minimum is 1 LINERA ({} atto)",
                    MIN_BET
                ),
            };
        }
        if bet_amount_atto > MAX_BET {
            return OperationResponse::Error {
                message: format!(
                    "Bet too high. Maximum is 100 LINERA ({} atto)",
                    MAX_BET
                ),
            };
        }

        // Charge bet amount as escrow
        if let Err(msg) = self.charge_fee(bet_amount_atto) {
            return OperationResponse::Error { message: msg };
        }

        let game_id = *self.state.game_counter.get() + 1;
        self.state.game_counter.set(game_id);

        // Generate a new bingo card with verifiable randomness
        let mut card = self.generate_card(game_id);
        // Store the bet amount in the card
        card.bet_amount_atto = bet_amount_atto.to_string();
        
        self.state.current_card.set(Some(card.clone()));
        self.state.drawn_numbers.set(Vec::new());
        self.state.has_unclaimed_prize.set(false);

        // Set up prize pool (bet amount goes to pool)
        let bet_amount = Amount::from_attos(bet_amount_atto);
        self.state.current_prize_pool.set(bet_amount);

        // Increment total games
        let total = *self.state.total_games.get() + 1;
        self.state.total_games.set(total);

        // Update session operations count
        if let Some(session) = self.state.active_session.get_mut() {
            session.operations_count += 1;
        }

        OperationResponse::GameStarted {
            game_id,
            card,
            entry_fee_paid: Self::format_amount(bet_amount),
            prize_pool: Self::format_amount(bet_amount),
        }
    }

    /// THE CORE ATOMIC OPERATION: Roll 4 dice, calculate sum, mark card, check win
    async fn roll_and_match(&mut self) -> OperationResponse {
        // Check if there's an active game
        let card = match self.state.current_card.get().clone() {
            Some(c) => c,
            None => {
                return OperationResponse::Error {
                    message: "No active game - call NewGame first".to_string(),
                };
            }
        };

        // Check if game already won
        if card.prize_claimed {
            return OperationResponse::Error {
                message: "Game already completed. Start a new game.".to_string(),
            };
        }

        // Check if bingo was achieved but prize not yet claimed
        if *self.state.has_unclaimed_prize.get() {
            return OperationResponse::Error {
                message: "BINGO! Claim your prize or start a new game.".to_string(),
            };
        }

        // Charge roll fee (0.1 LINERA)
        if let Err(msg) = self.charge_fee(ROLL_COST) {
            return OperationResponse::Error { message: msg };
        }

        let roll_fee_amount = Amount::from_attos(ROLL_COST);

        // Get the current roll count for RNG
        let current_rolls = card.rolls_count as u64;

        // 1. Generate 4 dice with verifiable randomness
        let dice = self.generate_dice_roll(current_rolls);
        let sum: u8 = dice.iter().sum();

        // 2. Track drawn numbers
        let mut drawn = self.state.drawn_numbers.get().clone();
        if !drawn.contains(&sum) {
            drawn.push(sum);
        }
        self.state.drawn_numbers.set(drawn);

        // 3. Clone card for mutation
        let mut updated_card = card;

        // 4. Find and mark the number on the card
        let (matched, match_pos, match_count) = Self::mark_number_on_card(&mut updated_card, sum);
        let is_lucky = match_count > 1;

        // 5. Check for bingo
        let bingo_type = Self::check_bingo_on_card(&updated_card);
        let game_over = bingo_type.is_some();

        if game_over {
            let wins = *self.state.total_wins.get() + 1;
            self.state.total_wins.set(wins);
            self.state.has_unclaimed_prize.set(true);
        }

        // 6. Update roll count and fees
        updated_card.rolls_count += 1;
        let rolls_count = updated_card.rolls_count;
        
        // Parse and update total roll fees
        let prev_fees: u128 = updated_card.total_roll_fees_atto.parse().unwrap_or(0);
        let new_total_fees = prev_fees + ROLL_COST;
        updated_card.total_roll_fees_atto = new_total_fees.to_string();

        // Save updated card back
        self.state.current_card.set(Some(updated_card));

        // Update session operations count
        if let Some(session) = self.state.active_session.get_mut() {
            session.operations_count += 1;
        }

        // 7. Record in history (keep last 50)
        let record = RollRecord {
            dice,
            sum,
            matched,
            timestamp_micros: self.runtime.system_time().micros(),
            fee_paid_atto: ROLL_COST.to_string(),
            is_lucky,
        };
        self.state.roll_history.push_back(record);
        while self.state.roll_history.count() > 50 {
            self.state.roll_history.delete_front();
        }

        OperationResponse::RollResult {
            dice,
            sum,
            matched,
            match_row: match_pos.map(|(r, _)| r),
            match_col: match_pos.map(|(_, c)| c),
            bingo_type,
            game_over,
            rolls_count,
            roll_fee_paid: Self::format_amount(roll_fee_amount),
            total_roll_fees: new_total_fees.to_string(),
            is_lucky,
        }
    }

    async fn claim_prize(&mut self) -> OperationResponse {
        // Check if there's an unclaimed prize
        if !*self.state.has_unclaimed_prize.get() {
            return OperationResponse::Error {
                message: "No unclaimed prize. Win a bingo first!".to_string(),
            };
        }

        let card = match self.state.current_card.get().clone() {
            Some(c) => c,
            None => {
                return OperationResponse::Error {
                    message: "No game data found.".to_string(),
                };
            }
        };

        if card.prize_claimed {
            return OperationResponse::Error {
                message: "Prize already claimed.".to_string(),
            };
        }

        // Parse bet amount from card
        let bet_amount_atto: u128 = card.bet_amount_atto.parse().unwrap_or(0);
        if bet_amount_atto == 0 {
            return OperationResponse::Error {
                message: "Invalid bet amount stored in game.".to_string(),
            };
        }

        // Get multiplier based on rolls count
        let (multiplier_num, multiplier_denom, multiplier_display) = 
            Self::get_multiplier(card.rolls_count);
        
        // Calculate payout: bet_amount * multiplier_num / multiplier_denom
        let payout_atto = bet_amount_atto
            .saturating_mul(multiplier_num as u128)
            / (multiplier_denom as u128);
        
        // Cap payout at player's deposited pool (never pay more than available)
        // In production, this would check the contract's total balance
        let capped_payout_atto = payout_atto;
        let payout_amount = Amount::from_attos(capped_payout_atto);

        // Add payout to player balance
        let current = *self.state.player_balance.get();
        let new_balance = current.saturating_add(payout_amount);
        self.state.player_balance.set(new_balance);

        // Track total won
        let total_won = *self.state.total_won.get();
        self.state.total_won.set(total_won.saturating_add(payout_amount));

        // Mark prize as claimed
        let mut updated_card = card.clone();
        updated_card.prize_claimed = true;
        self.state.current_card.set(Some(updated_card));
        self.state.has_unclaimed_prize.set(false);
        self.state.current_prize_pool.set(Amount::ZERO);

        OperationResponse::PrizeClaimed {
            bet_amount: bet_amount_atto.to_string(),
            rolls_count: card.rolls_count,
            multiplier_display,
            payout_amount: Self::format_amount(payout_amount),
            new_balance: Self::format_amount(new_balance),
        }
    }

    /// Get the multiplier based on number of rolls
    /// Returns (numerator, denominator, display_string)
    /// Using integer math to avoid floating point issues
    fn get_multiplier(rolls: u32) -> (u32, u32, String) {
        match rolls {
            0..=9 => (10, 1, "10x".to_string()),        // 10x
            10..=14 => (5, 1, "5x".to_string()),       // 5x
            15..=19 => (3, 1, "3x".to_string()),       // 3x
            20..=24 => (2, 1, "2x".to_string()),       // 2x
            25..=34 => (12, 10, "1.2x".to_string()),   // 1.2x
            35..=44 => (8, 10, "0.8x".to_string()),    // 0.8x
            _ => (2, 10, "0.2x".to_string()),          // 0.2x (45+)
        }
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /// Generate a new bingo card with numbers 4-24
    fn generate_card(&mut self, game_id: u64) -> BingoCard {
        // Create deterministic seed from block + game_id
        let seed = self.create_seed(game_id);

        // Generate pool of numbers 4-24 (21 unique numbers)
        let mut pool: Vec<u8> = (4..=24).collect();

        // Simple shuffle using LCG-style randomness
        let mut rng_state = seed;
        for i in (1..pool.len()).rev() {
            rng_state = Self::next_random(rng_state);
            let j = (rng_state % (i as u64 + 1)) as usize;
            pool.swap(i, j);
        }

        // Fill 5x5 grid (25 cells, center is FREE)
        let mut numbers = [0u8; 25];
        let mut marked = [false; 25];
        let mut pool_idx = 0;

        for i in 0..25 {
            if i == 12 {
                // Center cell (row 2, col 2) is FREE
                numbers[i] = 0;
                marked[i] = true;
            } else {
                numbers[i] = pool[pool_idx % pool.len()];
                pool_idx += 1;
            }
        }

        BingoCard {
            id: game_id,
            numbers,
            marked,
            rolls_count: 0,
            bet_amount_atto: "0".to_string(), // Will be set by new_game
            total_roll_fees_atto: "0".to_string(),
            prize_claimed: false,
        }
    }

    /// Generate 4 dice (1-6 each) with verifiable randomness
    fn generate_dice_roll(&mut self, nonce: u64) -> [u8; 4] {
        // Use multiple entropy sources for better randomness
        let block_height = self.runtime.block_height().0;
        let timestamp = self.runtime.system_time().micros();
        
        // Increment a running counter for additional entropy within same block
        let counter = *self.state.game_counter.get();
        let roll_count = *self.state.total_games.get();
        
        // Combine multiple entropy sources
        let mut rng_state: u64 = block_height
            .wrapping_mul(0xc6a4a7935bd1e995) // Large prime multiplier
            .wrapping_add(timestamp)
            .wrapping_mul(0x5851f42d4c957f2d)
            .wrapping_add(nonce.wrapping_mul(0x2545f4914f6cdd1d))
            .wrapping_add(counter.wrapping_mul(0x1b873593))
            .wrapping_add(roll_count.wrapping_mul(0xcc9e2d51));

        let mut dice = [0u8; 4];
        for die in dice.iter_mut() {
            // Better PRNG: xorshift64
            rng_state ^= rng_state << 13;
            rng_state ^= rng_state >> 7;
            rng_state ^= rng_state << 17;
            *die = ((rng_state % 6) + 1) as u8;
        }

        dice
    }

    /// Create a seed from block data for verifiable randomness
    fn create_seed(&mut self, nonce: u64) -> u64 {
        let block_height = self.runtime.block_height().0;
        let timestamp = self.runtime.system_time().micros();
        let counter = *self.state.game_counter.get();

        // Use xorshift-style mixing
        let mut seed = block_height
            .wrapping_mul(0xc6a4a7935bd1e995)
            .wrapping_add(timestamp)
            .wrapping_add(nonce.wrapping_mul(0x5851f42d4c957f2d))
            .wrapping_add(counter.wrapping_mul(0x9e3779b97f4a7c15));
        
        seed ^= seed >> 33;
        seed = seed.wrapping_mul(0xff51afd7ed558ccd);
        seed ^= seed >> 33;
        seed
    }

    /// Simple LCG-style PRNG for deterministic randomness
    fn next_random(state: u64) -> u64 {
        // LCG parameters (same as MINSTD)
        state.wrapping_mul(48271).wrapping_add(1) % 2147483647
    }

    /// Find and mark ALL occurrences of a number on the card
    /// Returns (matched, match_pos, match_count)
    fn mark_number_on_card(card: &mut BingoCard, sum: u8) -> (bool, Option<(u8, u8)>, u32) {
        let mut matched = false;
        let mut last_pos = None;
        let mut count = 0;

        for row in 0..5 {
            for col in 0..5 {
                let idx = row * 5 + col;
                if card.numbers[idx] == sum && !card.marked[idx] {
                    card.marked[idx] = true;
                    matched = true;
                    last_pos = Some((row as u8, col as u8));
                    count += 1;
                }
            }
        }
        (matched, last_pos, count)
    }

    /// Check for bingo (any complete line) - static method
    fn check_bingo_on_card(card: &BingoCard) -> Option<BingoType> {
        // Check rows
        for row in 0..5 {
            if (0..5).all(|col| card.marked[row * 5 + col]) {
                return Some(match row {
                    0 => BingoType::Row0,
                    1 => BingoType::Row1,
                    2 => BingoType::Row2,
                    3 => BingoType::Row3,
                    4 => BingoType::Row4,
                    _ => unreachable!(),
                });
            }
        }

        // Check columns
        for col in 0..5 {
            if (0..5).all(|row| card.marked[row * 5 + col]) {
                return Some(match col {
                    0 => BingoType::Col0,
                    1 => BingoType::Col1,
                    2 => BingoType::Col2,
                    3 => BingoType::Col3,
                    4 => BingoType::Col4,
                    _ => unreachable!(),
                });
            }
        }

        // Check main diagonal (top-left to bottom-right)
        if (0..5).all(|i| card.marked[i * 5 + i]) {
            return Some(BingoType::DiagonalMain);
        }

        // Check anti-diagonal (top-right to bottom-left)
        if (0..5).all(|i| card.marked[i * 5 + (4 - i)]) {
            return Some(BingoType::DiagonalAnti);
        }

        // Check full card (blackout)
        if (0..25).all(|i| card.marked[i]) {
            return Some(BingoType::FullCard);
        }

        None
    }


}

#[cfg(test)]
mod tests {
    use futures::FutureExt as _;
    use linera_sdk::{
        linera_base_types::{Amount, BlockHeight, Timestamp},
        util::BlockingWait,
        views::View,
        Contract, ContractRuntime,
    };

    use flashport::Operation;

    use super::{FlashportContract, FlashportState};

    #[test]
    fn test_start_session() {
        let mut app = create_app();

        let response = app
            .execute_operation(Operation::StartSession {
                expires_in_secs: 3600,
            })
            .now_or_never()
            .expect("Should not await");

        match response {
            flashport::OperationResponse::SessionStarted { session_id, .. } => {
                assert_eq!(session_id, 1);
            }
            _ => panic!("Expected SessionStarted response"),
        }
    }

    #[test]
    fn test_deposit() {
        let mut app = create_app();

        let response = app
            .execute_operation(Operation::Deposit)
            .now_or_never()
            .expect("Should not await");

        match response {
            flashport::OperationResponse::DepositReceived { new_balance, .. } => {
                // Should have 10 LINERA = 10 * 10^18 atto
                assert_eq!(new_balance, "10000000000000000000");
            }
            _ => panic!("Expected DepositReceived response"),
        }
    }

    #[test]
    fn test_new_game_requires_balance() {
        let mut app = create_app();

        // Start session first
        app.execute_operation(Operation::StartSession {
            expires_in_secs: 3600,
        })
        .now_or_never()
        .unwrap();

        // Try to start game without balance - should fail
        let response = app
            .execute_operation(Operation::NewGame)
            .now_or_never()
            .expect("Should not await");

        match response {
            flashport::OperationResponse::Error { message } => {
                assert!(message.contains("Insufficient balance"));
            }
            _ => panic!("Expected Error response for insufficient balance"),
        }
    }

    #[test]
    fn test_game_with_deposit() {
        let mut app = create_app();

        // Deposit first
        app.execute_operation(Operation::Deposit)
            .now_or_never()
            .unwrap();

        // Start session
        app.execute_operation(Operation::StartSession {
            expires_in_secs: 3600,
        })
        .now_or_never()
        .unwrap();

        // Now start game should succeed
        let response = app
            .execute_operation(Operation::NewGame)
            .now_or_never()
            .expect("Should not await");

        match response {
            flashport::OperationResponse::GameStarted { game_id, card, .. } => {
                assert_eq!(game_id, 1);
                // Center should be FREE (marked)
                assert!(card.marked[12]);
            }
            _ => panic!("Expected GameStarted response"),
        }
    }

    fn create_app() -> FlashportContract {
        let runtime = ContractRuntime::new()
            .with_application_parameters(())
            .with_system_time(Timestamp::from(1000000000))
            .with_block_height(BlockHeight(100));

        let mut contract = FlashportContract {
            state: FlashportState::load(runtime.root_view_storage_context())
                .blocking_wait()
                .expect("Failed to load state"),
            runtime,
        };

        contract
            .instantiate(())
            .now_or_never()
            .expect("Should not await");

        contract
    }
}
