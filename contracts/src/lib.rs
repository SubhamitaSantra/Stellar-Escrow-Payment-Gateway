#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, token
};

/// Error codes returned by the Escrow smart contract.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidState = 3,
    AccessDenied = 4,
    TimeoutExpired = 5,
    TimeoutNotExpired = 6,
    InvalidAmount = 7,
}

/// The possible states of the escrow contract.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum EscrowState {
    Deposited = 1,
    Released = 2,
    Disputed = 3,
    Refunded = 4,
}

/// The detailed record of an active escrow.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Escrow {
    pub buyer: Address,
    pub seller: Address,
    pub token: Address,
    pub amount: i128,
    pub state: EscrowState,
    pub timeout: u64, // Ledger timestamp (in seconds) after which dispute is locked
}

/// Storage keys for contract instance data.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DataKey {
    Escrow = 1,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Initializes the escrow contract, deposits funds from the buyer, and starts the dispute countdown.
    pub fn initialize(
        env: Env,
        buyer: Address,
        seller: Address,
        token: Address,
        amount: i128,
        timeout_duration: u64,
    ) -> Result<(), EscrowError> {
        // 1. Verify if the contract is already initialized.
        if env.storage().instance().has(&DataKey::Escrow) {
            return Err(EscrowError::AlreadyInitialized);
        }

        // 2. Validate inputs.
        if amount <= 0 {
            return Err(EscrowError::InvalidAmount);
        }

        // 3. Authenticate the buyer's signature.
        buyer.require_auth();

        // 4. Calculate absolute timeout timestamp.
        let current_time = env.ledger().timestamp();
        let timeout = current_time.checked_add(timeout_duration).ok_or(EscrowError::TimeoutExpired)?;

        // 5. Transfer tokens from buyer to the contract itself.
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&buyer, &env.current_contract_address(), &amount);

        // 6. Save the Escrow struct in the instance storage.
        let escrow = Escrow {
            buyer: buyer.clone(),
            seller: seller.clone(),
            token: token.clone(),
            amount,
            state: EscrowState::Deposited,
            timeout,
        };
        env.storage().instance().set(&DataKey::Escrow, &escrow);

        // 7. Emit an initialization event.
        env.events().publish(
            (symbol_short!("init"), buyer, seller),
            (amount, timeout),
        );

        Ok(())
    }

    /// Releases funds to the seller.
    /// Can be called by:
    /// - The buyer at any time (confirming delivery).
    /// - The seller after the timeout duration has passed (if no dispute has been raised).
    pub fn release(env: Env, caller: Address) -> Result<(), EscrowError> {
        // 1. Retrieve the current escrow state.
        let mut escrow: Escrow = env
            .storage()
            .instance()
            .get(&DataKey::Escrow)
            .ok_or(EscrowError::NotInitialized)?;

        // 2. State must be Deposited.
        if escrow.state != EscrowState::Deposited {
            return Err(EscrowError::InvalidState);
        }

        // 3. Authenticate the caller.
        caller.require_auth();

        // 4. Validate caller role and timelock constraints.
        if caller == escrow.buyer {
            // Buyer can confirm delivery and release funds at any time.
        } else if caller == escrow.seller {
            // Seller can only claim funds after the timeout window has closed.
            let current_time = env.ledger().timestamp();
            if current_time < escrow.timeout {
                return Err(EscrowError::TimeoutNotExpired);
            }
        } else {
            return Err(EscrowError::AccessDenied);
        }

        // 5. Update state.
        escrow.state = EscrowState::Released;
        env.storage().instance().set(&DataKey::Escrow, &escrow);

        // 6. Transfer funds to the seller.
        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(&env.current_contract_address(), &escrow.seller, &escrow.amount);

        // 7. Emit release event.
        env.events().publish(
            (symbol_short!("released"), escrow.buyer, escrow.seller),
            escrow.amount,
        );

        Ok(())
    }

    /// Disputes the transaction, returning all deposited funds to the buyer.
    /// Can only be called by the buyer within the timeout window.
    pub fn dispute(env: Env) -> Result<(), EscrowError> {
        // 1. Retrieve the current escrow state.
        let mut escrow: Escrow = env
            .storage()
            .instance()
            .get(&DataKey::Escrow)
            .ok_or(EscrowError::NotInitialized)?;

        // 2. State must be Deposited.
        if escrow.state != EscrowState::Deposited {
            return Err(EscrowError::InvalidState);
        }

        // 3. Verify dispute is raised BEFORE timeout.
        let current_time = env.ledger().timestamp();
        if current_time >= escrow.timeout {
            return Err(EscrowError::TimeoutExpired);
        }

        // 4. Authenticate buyer.
        escrow.buyer.require_auth();

        // 5. Update state.
        escrow.state = EscrowState::Refunded;
        env.storage().instance().set(&DataKey::Escrow, &escrow);

        // 6. Transfer funds back to buyer.
        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(&env.current_contract_address(), &escrow.buyer, &escrow.amount);

        // 7. Emit refund event.
        env.events().publish(
            (symbol_short!("refunded"), escrow.buyer, escrow.seller),
            escrow.amount,
        );

        Ok(())
    }

    /// Read-only method to fetch current escrow details.
    pub fn get_escrow(env: Env) -> Option<Escrow> {
        env.storage().instance().get(&DataKey::Escrow)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env};

    fn setup_test_env() -> (Env, EscrowContractClient, Address, Address, token::Client, token::AdminClient) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        let buyer = Address::generate(&env);
        let seller = Address::generate(&env);

        let token_admin = Address::generate(&env);
        let token_id = env.register_stellar_asset_contract(token_admin.clone());
        let token_client = token::Client::new(&env, &token_id);
        let token_admin_client = token::AdminClient::new(&env, &token_id);

        // Fund the buyer with 1,000,000,000 stroops
        token_admin_client.mint(&buyer, &1_000_000_000);

        (env, client, buyer, seller, token_client, token_admin_client)
    }

    #[test]
    fn test_successful_flow() {
        let (env, client, buyer, seller, token, _) = setup_test_env();

        let amount = 500_000_000;
        let timeout_duration = 3600; // 1 hour

        // Initialize and Deposit
        client.initialize(&buyer, &seller, &token.address, &amount, &timeout_duration);

        // Verify balance updates
        assert_eq!(token.balance(&buyer), 500_000_000);
        assert_eq!(token.balance(&client.address), 500_000_000);

        // Check contract state
        let escrow = client.get_escrow().unwrap();
        assert_eq!(escrow.buyer, buyer);
        assert_eq!(escrow.seller, seller);
        assert_eq!(escrow.amount, amount);
        assert_eq!(escrow.state, EscrowState::Deposited);

        // Release funds (by Buyer)
        client.release(&buyer);

        // Verify funds transferred to Seller
        assert_eq!(token.balance(&seller), 500_000_000);
        assert_eq!(token.balance(&client.address), 0);

        let escrow_updated = client.get_escrow().unwrap();
        assert_eq!(escrow_updated.state, EscrowState::Released);
    }

    #[test]
    fn test_dispute_and_refund() {
        let (env, client, buyer, seller, token, _) = setup_test_env();

        let amount = 300_000_000;
        let timeout_duration = 3600;

        // Initialize and Deposit
        client.initialize(&buyer, &seller, &token.address, &amount, &timeout_duration);

        // Raise dispute before timeout (current ledger time is 0)
        assert!(env.ledger().timestamp() < client.get_escrow().unwrap().timeout);
        client.dispute();

        // Verify buyer refunded
        assert_eq!(token.balance(&buyer), 1_000_000_000);
        assert_eq!(token.balance(&client.address), 0);

        let escrow = client.get_escrow().unwrap();
        assert_eq!(escrow.state, EscrowState::Refunded);
    }

    #[test]
    fn test_seller_release_after_timeout() {
        let (env, client, buyer, seller, token, _) = setup_test_env();

        let amount = 200_000_000;
        let timeout_duration = 1000;

        client.initialize(&buyer, &seller, &token.address, &amount, &timeout_duration);

        // Attempting release by seller should fail before timeout
        // Let's shift the ledger time past the timeout of 1000
        env.ledger().with_mut(|l| {
            l.timestamp = 2000; 
        });

        // Let's release now by seller
        client.release(&seller);

        assert_eq!(token.balance(&seller), 200_000_000);
        assert_eq!(token.balance(&client.address), 0);
    }
}
