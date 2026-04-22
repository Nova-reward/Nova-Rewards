#!/bin/bash

# Data Seeding Script for Staging Environment
# Automates provisioning of test data

set -e

DB_HOST=${DB_HOST:-postgres-staging}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-staging_user}
DB_PASSWORD=${DB_PASSWORD:-staging_password}
DB_NAME=${DB_NAME:-nova_rewards_staging}
SEED_DIR=${SEED_DIR:-./seeds}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Wait for database to be ready
wait_for_db() {
    log "Waiting for PostgreSQL to be ready..."
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" 2>/dev/null; then
            log "PostgreSQL is ready"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    
    log "PostgreSQL did not become ready in time"
    return 1
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
        -- Create extensions
        CREATE EXTENSION IF NOT EXISTS uuid-ossp;
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
        
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            email VARCHAR(255) UNIQUE NOT NULL,
            username VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Wallet table
        CREATE TABLE IF NOT EXISTS wallets (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            address VARCHAR(255) UNIQUE NOT NULL,
            balance DECIMAL(36, 18) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Rewards table
        CREATE TABLE IF NOT EXISTS rewards (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            amount DECIMAL(36, 18) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Transactions table
        CREATE TABLE IF NOT EXISTS transactions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            from_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
            to_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
            amount DECIMAL(36, 18) NOT NULL,
            transaction_hash VARCHAR(255),
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Referrals table
        CREATE TABLE IF NOT EXISTS referrals (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            referee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            bonus_amount DECIMAL(36, 18),
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
EOF
    
    log "Migrations completed"
}

# Seed test users
seed_users() {
    log "Seeding test users..."
    
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
        INSERT INTO users (email, username, role) VALUES
            ('admin@test.com', 'admin', 'admin'),
            ('user1@test.com', 'testuser1', 'user'),
            ('user2@test.com', 'testuser2', 'user'),
            ('user3@test.com', 'testuser3', 'user'),
            ('user4@test.com', 'testuser4', 'user'),
            ('user5@test.com', 'testuser5', 'user')
        ON CONFLICT (email) DO NOTHING;
EOF
    
    log "Test users seeded"
}

# Seed test wallets
seed_wallets() {
    log "Seeding test wallets..."
    
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
        INSERT INTO wallets (user_id, address, balance)
        SELECT id, 'stellar_' || substring(id::text, 1, 8) || 'test', 1000
        FROM users
        WHERE id NOT IN (SELECT user_id FROM wallets);
EOF
    
    log "Test wallets seeded"
}

# Seed test rewards
seed_rewards() {
    log "Seeding test rewards..."
    
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
        INSERT INTO rewards (user_id, amount, status)
        SELECT id, 100 + (random() * 900)::numeric, 'completed'
        FROM users
        WHERE id NOT IN (SELECT user_id FROM rewards WHERE status = 'completed' LIMIT 100)
        LIMIT 100;
EOF
    
    log "Test rewards seeded"
}

# Seed test transactions
seed_transactions() {
    log "Seeding test transactions..."
    
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
        INSERT INTO transactions (from_wallet_id, to_wallet_id, amount, status)
        SELECT 
            (SELECT id FROM wallets LIMIT 1 OFFSET floor(random() * (SELECT count(*) FROM wallets))::int),
            (SELECT id FROM wallets LIMIT 1 OFFSET floor(random() * (SELECT count(*) FROM wallets))::int),
            (random() * 500)::numeric,
            'completed'
        FROM generate_series(1, 50);
EOF
    
    log "Test transactions seeded"
}

# Seed test referrals
seed_referrals() {
    log "Seeding test referrals..."
    
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
        INSERT INTO referrals (referrer_id, referee_id, bonus_amount, status)
        SELECT 
            u1.id,
            u2.id,
            50 + (random() * 250)::numeric,
            'completed'
        FROM users u1, users u2
        WHERE u1.id != u2.id
        LIMIT 20;
EOF
    
    log "Test referrals seeded"
}

# Clear all data
clear_data() {
    log "Clearing all seeded data..."
    
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
        TRUNCATE TABLE referrals CASCADE;
        TRUNCATE TABLE transactions CASCADE;
        TRUNCATE TABLE rewards CASCADE;
        TRUNCATE TABLE wallets CASCADE;
        TRUNCATE TABLE users CASCADE;
EOF
    
    log "Data cleared"
}

# Main seeding function
main() {
    local action="${1:-seed}"
    
    log "Starting staging database seeding"
    
    case $action in
        seed)
            wait_for_db
            run_migrations
            seed_users
            seed_wallets
            seed_rewards
            seed_transactions
            seed_referrals
            log "Staging database seeded successfully"
            ;;
        clear)
            wait_for_db
            clear_data
            log "Staging database cleared"
            ;;
        *)
            echo "Usage: $0 {seed|clear}"
            exit 1
            ;;
    esac
}

main "$@"
