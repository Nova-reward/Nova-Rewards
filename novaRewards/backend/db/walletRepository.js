const { query } = require('./index');

async function createWallet({ userId, address, isPrimary = false, isActive = true }) {
     const client = await require('./index').pool.connect();
     try {
          await client.query('BEGIN');

          if (isPrimary) {
               await client.query(
                    'UPDATE wallets SET is_primary = FALSE WHERE user_id = $1',
                    [userId]
               );
          }

          const result = await client.query(
               `INSERT INTO wallets (user_id, address, is_primary, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
               [userId, address, isPrimary, isActive]
          );

          await client.query('COMMIT');
          return result.rows[0];
     } catch (err) {
          await client.query('ROLLBACK');
          throw err;
     } finally {
          client.release();
     }
}

async function getWalletById(id) {
     const { rows } = await query('SELECT * FROM wallets WHERE id = $1', [id]);
     return rows[0] || null;
}

async function getWalletByAddress(address) {
     const { rows } = await query('SELECT * FROM wallets WHERE address = $1', [address]);
     return rows[0] || null;
}

async function getWalletsByUserId(userId) {
     const { rows } = await query('SELECT * FROM wallets WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
     return rows;
}

async function setPrimaryWallet(walletId, userId) {
     const client = await require('./index').pool.connect();
     try {
          await client.query('BEGIN');
          await client.query('UPDATE wallets SET is_primary = FALSE WHERE user_id = $1', [userId]);
          const { rows } = await client.query(
               'UPDATE wallets SET is_primary = TRUE WHERE id = $1 RETURNING *',
               [walletId]
          );
          await client.query('COMMIT');
          return rows[0] || null;
     } catch (err) {
          await client.query('ROLLBACK');
          throw err;
     } finally {
          client.release();
     }
}

async function markWalletInactive(walletId) {
     const { rows } = await query(
          'UPDATE wallets SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *',
          [walletId]
     );
     return rows[0] || null;
}

module.exports = {
     createWallet,
     getWalletById,
     getWalletByAddress,
     getWalletsByUserId,
     setPrimaryWallet,
     markWalletInactive,
};
