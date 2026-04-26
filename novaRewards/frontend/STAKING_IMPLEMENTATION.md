# Staking Interface Implementation

## Overview

This implementation provides a comprehensive staking interface for NOVA tokens, allowing users to:
- Stake tokens to earn rewards
- View their active stake position
- Track accrued rewards in real-time
- Claim rewards without unstaking
- Unstake with cooldown period management
- View pool statistics (APY, TVL, total stakers)

## Features Implemented

### ✅ Stake Form
- Amount input with validation
- MAX button to stake full balance
- Real-time balance display
- Input validation (min/max amounts)
- Loading states during transactions
- Error handling and user feedback

### ✅ Active Stake Position Card
- Displays staked amount
- Shows accrued rewards
- Displays total value (stake + rewards)
- Cooldown status with countdown timer
- Days staked calculation
- Claim rewards button
- Unstake button with status-aware behavior

### ✅ Staking Statistics
- Current APY with animated counters
- Total Value Locked (TVL)
- Total number of stakers
- Daily/Monthly/Yearly reward breakdowns
- Average stake per user
- Real-time updates every 30 seconds

### ✅ Unstake Flow
- Cooldown period display
- Countdown timer showing time remaining
- Estimated unlock time
- Status indicators (active/cooldown)
- Confirmation dialogs

### ✅ Claim Rewards
- On-chain transaction via Freighter
- Claim without unstaking
- Transaction confirmation
- Balance updates

## File Structure

```
novaRewards/frontend/
├── components/
│   └── staking/
│       ├── StakeForm.js              # Stake input form
│       ├── StakePositionCard.js      # Active position display
│       └── StakingStats.js           # Pool statistics
├── lib/
│   └── stakingService.js             # Contract interaction service
├── pages/
│   ├── staking.js                    # Main staking page
│   └── api/
│       └── staking/
│           └── stats.js              # Stats API endpoint
└── __tests__/
    └── staking/
        ├── StakeForm.test.js         # Form tests
        └── StakePositionCard.test.js # Position card tests
```

## Components

### StakeForm

**Location:** `components/staking/StakeForm.js`

**Props:**
- `balance` (number): Available balance for staking
- `onStake` (function): Callback when stake is submitted
- `isLoading` (boolean): Loading state

**Features:**
- Input validation
- MAX button functionality
- Error messages
- Disabled states
- Loading indicators

**Usage:**
```jsx
<StakeForm
  balance={availableBalance}
  onStake={handleStake}
  isLoading={isLoading}
/>
```

### StakePositionCard

**Location:** `components/staking/StakePositionCard.js`

**Props:**
- `stakePosition` (object): Current stake position data
- `onUnstake` (function): Callback for unstake action
- `onClaimRewards` (function): Callback for claiming rewards
- `isLoading` (boolean): Loading state

**Stake Position Object:**
```javascript
{
  stakedAmount: number,      // Amount staked
  accruedRewards: number,    // Rewards earned
  stakedAt: Date,            // Stake timestamp
  status: string,            // 'active' | 'cooldown'
  cooldownEnd: string|null   // ISO date string
}
```

**Features:**
- Empty state display
- Active position display
- Cooldown countdown timer
- Action buttons (claim/unstake)
- Status indicators

### StakingStats

**Location:** `components/staking/StakingStats.js`

**Props:**
- `apy` (number): Annual percentage yield
- `tvl` (number): Total value locked
- `totalStakers` (number): Number of stakers
- `isLoading` (boolean): Loading state

**Features:**
- Animated number counters
- Responsive grid layout
- Daily/Monthly/Yearly breakdowns
- Loading skeletons

## Services

### stakingService.js

**Location:** `lib/stakingService.js`

**Functions:**

#### `stakeTokens(stakerPublicKey, amount)`
Stakes tokens for a user.

**Parameters:**
- `stakerPublicKey` (string): User's Stellar public key
- `amount` (number): Amount to stake

**Returns:** Promise<{ success, hash, amount }>

#### `unstakeTokens(stakerPublicKey)`
Unstakes tokens for a user.

**Parameters:**
- `stakerPublicKey` (string): User's Stellar public key

**Returns:** Promise<{ success, hash, returnedAmount }>

#### `getStakePosition(stakerPublicKey)`
Retrieves current stake position.

**Parameters:**
- `stakerPublicKey` (string): User's Stellar public key

**Returns:** Promise<StakePosition|null>

#### `getStakingStats()`
Fetches pool statistics.

**Returns:** Promise<{ apy, tvl, totalStakers, totalRewardsDistributed }>

#### `claimRewards(stakerPublicKey)`
Claims accrued rewards without unstaking.

**Parameters:**
- `stakerPublicKey` (string): User's Stellar public key

**Returns:** Promise<{ success, hash }>

#### `calculateEstimatedRewards(amount, days, apy)`
Calculates estimated rewards.

**Parameters:**
- `amount` (number): Stake amount
- `days` (number): Number of days
- `apy` (number): Annual percentage yield

**Returns:** number (estimated rewards)

## API Endpoints

### GET /api/staking/stats

Returns staking pool statistics.

**Response:**
```json
{
  "apy": 12.5,
  "tvl": 2500000,
  "totalStakers": 342,
  "totalRewardsDistributed": 125000,
  "averageStakeAmount": 7309.94,
  "lastUpdated": "2024-01-01T00:00:00.000Z"
}
```

## Contract Integration

The staking service integrates with the Stellar smart contract using the following methods:

### Contract Methods Used:
- `stake(staker: Address, amount: i128)` - Stake tokens
- `unstake(staker: Address) -> i128` - Unstake and return total
- `get_stake(staker: Address) -> Option<StakeRecord>` - Get stake info
- `get_annual_rate() -> i128` - Get current APY
- `claim_rewards(staker: Address)` - Claim rewards (if implemented)

### Transaction Flow:

1. **Staking:**
   - User enters amount
   - Form validates input
   - Transaction built with contract call
   - Signed via Freighter
   - Submitted to Stellar network
   - UI updates on confirmation

2. **Unstaking:**
   - User clicks unstake
   - Confirmation dialog shown
   - Transaction built
   - Signed and submitted
   - Cooldown period starts (if applicable)
   - UI shows countdown

3. **Claiming Rewards:**
   - User clicks claim
   - Transaction built
   - Signed and submitted
   - Rewards transferred
   - Position updated

## Configuration

### Environment Variables

Add to `.env.local`:

```env
# Staking Contract ID
NEXT_PUBLIC_STAKING_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# API URL (for stats endpoint)
NEXT_PUBLIC_API_URL=http://localhost:3001

# Stellar Configuration
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK=testnet
```

## Usage

### Accessing the Staking Page

Navigate to `/staking` in your application.

**Requirements:**
- Wallet must be connected (protected by WalletGuard)
- User must have NOVA tokens

### Staking Tokens

1. Enter amount or click MAX
2. Click "Stake Tokens"
3. Approve transaction in Freighter
4. Wait for confirmation
5. View updated position

### Claiming Rewards

1. View accrued rewards in position card
2. Click "Claim Rewards"
3. Approve transaction
4. Rewards added to wallet

### Unstaking

1. Click "Unstake" button
2. Confirm action
3. Approve transaction
4. Wait for cooldown (if applicable)
5. Complete unstake when ready

## Testing

### Run Tests

```bash
cd novaRewards/frontend
npm test staking
```

### Test Coverage

- ✅ Stake form validation
- ✅ MAX button functionality
- ✅ Position card display
- ✅ Cooldown countdown
- ✅ Button states
- ✅ Error handling
- ✅ Loading states
- ✅ Wallet connection checks

### Manual Testing

1. **Test Staking:**
   - Connect wallet
   - Navigate to /staking
   - Enter amount and stake
   - Verify transaction in Freighter
   - Check position updates

2. **Test Cooldown:**
   - Stake tokens
   - Initiate unstake
   - Verify countdown timer
   - Wait for cooldown completion
   - Complete unstake

3. **Test Rewards:**
   - Wait for rewards to accrue
   - Click claim rewards
   - Verify transaction
   - Check balance update

## Acceptance Criteria Status

✅ **Stake form with amount input and max button**
- Input field with validation
- MAX button uses full balance
- Real-time balance display
- Error messages

✅ **Active stake position card shows required info**
- Staked amount displayed
- Accrued rewards shown
- Cooldown status with countdown
- Days staked calculation

✅ **APY and pool TVL displayed with real-time updates**
- Current APY shown
- TVL displayed
- Total stakers count
- Updates every 30 seconds
- Animated counters

✅ **Unstake flow shows cooldown period**
- Cooldown countdown timer
- Estimated unlock time
- Status indicators
- Complete unstake button when ready

✅ **Claim rewards button triggers on-chain transaction**
- Claim button in position card
- Freighter integration
- Transaction confirmation
- Balance updates

## Troubleshooting

### Staking Transaction Fails

**Possible causes:**
- Insufficient balance
- Contract not initialized
- Network issues
- Freighter not connected

**Solutions:**
- Check wallet balance
- Verify contract ID in .env
- Check network connection
- Reconnect Freighter

### Position Not Loading

**Possible causes:**
- Contract call failed
- No active stake
- Network timeout

**Solutions:**
- Check browser console
- Verify contract ID
- Refresh page
- Check Horizon status

### Cooldown Not Updating

**Possible causes:**
- JavaScript timer issue
- Component unmounted
- Invalid cooldown date

**Solutions:**
- Refresh page
- Check browser console
- Verify cooldown end date

## Future Enhancements

### Potential Improvements:
1. **Compound Staking** - Auto-restake rewards
2. **Multiple Stakes** - Allow multiple positions
3. **Stake History** - Transaction history view
4. **Reward Calculator** - Interactive calculator
5. **Notifications** - Cooldown completion alerts
6. **Charts** - Rewards over time visualization
7. **Leaderboard** - Top stakers display
8. **Referral Bonuses** - Bonus APY for referrals

## Support

For issues or questions:
1. Check browser console for errors
2. Verify environment variables
3. Check Freighter connection
4. Review transaction on Stellar Expert
5. Check contract status on Horizon

## Resources

- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Freighter Wallet](https://www.freighter.app/)
- [Stellar Expert](https://stellar.expert/)
- [Contract Source](../../contracts/nova-rewards/)
