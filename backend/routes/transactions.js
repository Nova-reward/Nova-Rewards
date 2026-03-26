const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const StellarSdk = require('@stellar/stellar-sdk');

// PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Horizon server instance
const server = new StellarSdk.Horizon.Server(process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org');

/**
 * GET /api/transactions/:walletAddress
 * Get all transactions for a specific wallet with pagination
 * 
 * Query parameters:
 * - limit: Number of transactions to return (default: 20, max: 100)
 * - offset: Number of transactions to skip (default: 0)
 */
router.get('/transactions/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        
        // Parse pagination parameters with defaults and validation
        let limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        // Validate limit (between 1 and 100)
        if (limit < 1) limit = 1;
        if (limit > 100) limit = 100;
        
        // Validate offset (can't be negative)
        if (offset < 0) {
            return res.status(400).json({ 
                error: 'Invalid offset parameter', 
                message: 'Offset must be a non-negative number' 
            });
        }
        
        // Validate wallet address format
        if (!walletAddress || !StellarSdk.StrKey.isValidEd25519PublicKey(walletAddress)) {
            return res.status(400).json({ 
                error: 'Invalid wallet address', 
                message: 'Please provide a valid Stellar public key' 
            });
        }
        
        let transactions = [];
        let totalCount = 0;
        let source = 'none';
        
        // Try to get from Horizon first
        try {
            const horizonTransactions = await server
                .transactions()
                .forAccount(walletAddress)
                .order('desc')
                .limit(limit + offset) // Need to get enough for pagination
                .call();
            
            // Apply pagination manually since Horizon doesn't support offset directly
            const allTransactions = horizonTransactions.records;
            const paginatedTransactions = allTransactions.slice(offset, offset + limit);
            
            // Transform Horizon transactions to our format
            transactions = paginatedTransactions.map(tx => ({
                id: tx.id,
                hash: tx.hash,
                ledger: tx.ledger,
                created_at: tx.created_at,
                source_account: tx.source_account,
                fee_paid: tx.fee_charged,
                operation_count: tx.operation_count,
                memo: tx.memo,
                memo_type: tx.memo_type,
                successful: tx.successful,
                paging_token: tx.paging_token
            }));
            
            totalCount = allTransactions.length;
            source = 'horizon';
            
        } catch (horizonError) {
            console.log('Horizon query failed, falling back to PostgreSQL:', horizonError.message);
            
            // Fallback to PostgreSQL with pagination
            try {
                // Get total count first
                const countResult = await pool.query(
                    'SELECT COUNT(*) FROM transactions WHERE wallet_address = $1',
                    [walletAddress]
                );
                totalCount = parseInt(countResult.rows[0].count);
                
                // Get paginated transactions
                const pgResult = await pool.query(
                    `SELECT * FROM transactions 
                     WHERE wallet_address = $1 
                     ORDER BY created_at DESC 
                     LIMIT $2 OFFSET $3`,
                    [walletAddress, limit, offset]
                );
                
                transactions = pgResult.rows;
                source = 'postgres';
                
            } catch (pgError) {
                console.error('PostgreSQL query failed:', pgError);
                return res.status(500).json({ 
                    error: 'Database error', 
                    message: 'Failed to fetch transactions from database',
                    details: process.env.NODE_ENV === 'development' ? pgError.message : undefined
                });
            }
        }
        
        // Return response with pagination metadata
        res.json({
            success: true,
            data: transactions,
            source: source,
            pagination: {
                limit: limit,
                offset: offset,
                total: totalCount,
                has_more: (offset + limit) < totalCount,
                next_offset: (offset + limit) < totalCount ? offset + limit : null,
                prev_offset: offset > 0 ? Math.max(0, offset - limit) : null
            },
            wallet: walletAddress
        });
        
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ 
            error: 'Server error', 
            message: 'Failed to fetch transactions',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * POST /api/transactions/record
 * Record a transaction - verifies on Horizon before saving locally
 */
router.post('/transactions/record', async (req, res) => {
    try {
        const { transactionHash, walletAddress, amount, operationType, memo } = req.body;

        // Validate required fields
        if (!transactionHash || !walletAddress || !amount || !operationType) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['transactionHash', 'walletAddress', 'amount', 'operationType']
            });
        }

        // Validate wallet address format
        if (!StellarSdk.StrKey.isValidEd25519PublicKey(walletAddress)) {
            return res.status(400).json({ 
                error: 'Invalid wallet address format' 
            });
        }

        // Step 1: Verify transaction exists on Horizon
        let horizonTransaction = null;
        try {
            horizonTransaction = await server.transactions().transaction(transactionHash).call();
        } catch (horizonError) {
            // Transaction not found on Horizon
            return res.status(400).json({
                error: 'Transaction not found on Stellar network',
                message: 'The transaction hash does not exist on Horizon. Please verify the hash and try again.',
                transactionHash: transactionHash
            });
        }

        // Step 2: Verify the transaction involves the wallet address
        const isSourceAccount = horizonTransaction.source_account === walletAddress;
        const isInvolved = horizonTransaction.operations?.some(op => 
            op.source_account === walletAddress || 
            (op.account === walletAddress) ||
            (op.from === walletAddress) ||
            (op.to === walletAddress)
        );

        if (!isSourceAccount && !isInvolved) {
            return res.status(400).json({
                error: 'Transaction not related to wallet',
                message: 'The transaction hash does not involve the provided wallet address.',
                transactionHash: transactionHash,
                walletAddress: walletAddress
            });
        }

        // Step 3: Check if transaction already exists in local database
        const existingCheck = await pool.query(
            'SELECT id FROM transactions WHERE transaction_hash = $1',
            [transactionHash]
        );

        if (existingCheck.rows.length > 0) {
            return res.status(409).json({
                error: 'Transaction already recorded',
                message: 'This transaction has already been recorded in the database.',
                transactionHash: transactionHash
            });
        }

        // Step 4: Record the transaction in PostgreSQL
        const result = await pool.query(
            `INSERT INTO transactions 
             (transaction_hash, wallet_address, amount, operation_type, memo, ledger, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING *`,
            [
                transactionHash,
                walletAddress,
                amount,
                operationType,
                memo || null,
                horizonTransaction.ledger,
                horizonTransaction.created_at
            ]
        );

        // Step 5: Return success response
        res.status(201).json({
            success: true,
            message: 'Transaction verified and recorded successfully',
            transaction: {
                id: result.rows[0].id,
                hash: result.rows[0].transaction_hash,
                walletAddress: result.rows[0].wallet_address,
                amount: result.rows[0].amount,
                operationType: result.rows[0].operation_type,
                memo: result.rows[0].memo,
                ledger: result.rows[0].ledger,
                createdAt: result.rows[0].created_at
            },
            horizonVerification: {
                verified: true,
                sourceAccount: horizonTransaction.source_account,
                successful: horizonTransaction.successful,
                ledger: horizonTransaction.ledger
            }
        });

    } catch (error) {
        console.error('Error recording transaction:', error);
        res.status(500).json({ 
            error: 'Server error', 
            message: 'Failed to record transaction',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;