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

module.exports = router;