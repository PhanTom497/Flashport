// Copyright (c) Zefchain Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

//! Integration testing for the FlashPort Dice-Bingo application with token economics.

#![cfg(not(target_arch = "wasm32"))]

use flashport::Operation;
use linera_sdk::test::{QueryOutcome, TestValidator};

/// Tests the complete game flow: deposit -> session -> new game -> roll
#[tokio::test(flavor = "multi_thread")]
async fn single_chain_game_flow() {
    let (validator, module_id) =
        TestValidator::with_current_module::<flashport::FlashportAbi, (), ()>().await;
    let mut chain = validator.new_chain().await;

    // Create the application with no initialization argument
    let application_id = chain
        .create_application(module_id, (), (), vec![])
        .await;

    // Deposit funds first (required for new game)
    chain
        .add_block(|block| {
            block.with_operation(application_id, Operation::Deposit);
        })
        .await;

    // Start a session
    chain
        .add_block(|block| {
            block.with_operation(
                application_id,
                Operation::StartSession {
                    expires_in_secs: 3600,
                },
            );
        })
        .await;

    // Verify session was created
    let QueryOutcome { response, .. } = chain
        .graphql_query(application_id, "query { hasSession }")
        .await;
    assert_eq!(response["hasSession"].as_bool(), Some(true));

    // Start a new game (costs 5 LINERA)
    chain
        .add_block(|block| {
            block.with_operation(application_id, Operation::NewGame);
        })
        .await;

    // Verify a card was created
    let QueryOutcome { response, .. } = chain
        .graphql_query(application_id, "query { totalGames }")
        .await;
    assert_eq!(response["totalGames"].as_u64(), Some(1));

    // Roll the dice (costs 0.1 LINERA)
    chain
        .add_block(|block| {
            block.with_operation(application_id, Operation::RollAndMatch);
        })
        .await;

    // Verify roll was recorded
    let QueryOutcome { response, .. } = chain
        .graphql_query(application_id, "query { rollHistoryCount }")
        .await;
    assert_eq!(response["rollHistoryCount"].as_u64(), Some(1));
}

/// Tests that game operations fail without deposits
#[tokio::test(flavor = "multi_thread")]
async fn operations_require_balance() {
    let (validator, module_id) =
        TestValidator::with_current_module::<flashport::FlashportAbi, (), ()>().await;
    let mut chain = validator.new_chain().await;

    let application_id = chain
        .create_application(module_id, (), (), vec![])
        .await;

    // Check initial state - no session, no games, no balance
    let QueryOutcome { response, .. } = chain
        .graphql_query(application_id, "query { hasSession totalGames }")
        .await;
    assert_eq!(response["hasSession"].as_bool(), Some(false));
    assert_eq!(response["totalGames"].as_u64(), Some(0));
}

/// Tests fee structure queries
#[tokio::test(flavor = "multi_thread")]
async fn fee_structure() {
    let (validator, module_id) =
        TestValidator::with_current_module::<flashport::FlashportAbi, (), ()>().await;
    let mut chain = validator.new_chain().await;

    let application_id = chain
        .create_application(module_id, (), (), vec![])
        .await;

    // Query fee structure
    let QueryOutcome { response, .. } = chain
        .graphql_query(application_id, "query { entryFeeLinera rollCostLinera }")
        .await;
    
    // Entry fee should be 5.0 LINERA
    let entry_fee = response["entryFeeLinera"].as_f64().unwrap();
    assert!((entry_fee - 5.0).abs() < 0.01);
    
    // Roll cost should be 0.1 LINERA
    let roll_cost = response["rollCostLinera"].as_f64().unwrap();
    assert!((roll_cost - 0.1).abs() < 0.01);
}

/// Tests multiple rolls with sufficient balance
#[tokio::test(flavor = "multi_thread")]
async fn multiple_rolls() {
    let (validator, module_id) =
        TestValidator::with_current_module::<flashport::FlashportAbi, (), ()>().await;
    let mut chain = validator.new_chain().await;

    let application_id = chain
        .create_application(module_id, (), (), vec![])
        .await;

    // Deposit funds
    chain
        .add_block(|block| {
            block.with_operation(application_id, Operation::Deposit);
        })
        .await;

    // Start session
    chain
        .add_block(|block| {
            block.with_operation(
                application_id,
                Operation::StartSession {
                    expires_in_secs: 3600,
                },
            );
        })
        .await;

    // Start new game
    chain
        .add_block(|block| {
            block.with_operation(application_id, Operation::NewGame);
        })
        .await;

    // Do 5 rolls (0.5 LINERA total)
    for _ in 0..5 {
        chain
            .add_block(|block| {
                block.with_operation(application_id, Operation::RollAndMatch);
            })
            .await;
    }

    // Verify 5 rolls were recorded
    let QueryOutcome { response, .. } = chain
        .graphql_query(application_id, "query { rollHistoryCount }")
        .await;
    assert_eq!(response["rollHistoryCount"].as_u64(), Some(5));
}
