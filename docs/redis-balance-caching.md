# Redis Caching for Wallet Balance

## Overview
The wallet balance endpoint uses Redis caching to reduce latency and prevent rate limiting from Stellar Horizon RPC calls.

## Architecture

### Cache-Aside Pattern
1. **Check cache**: Try to get balance from Redis
2. **Cache hit**: Return cached balance (~1ms)
3. **Cache miss**: Fetch from Horizon, store in Redis, return balance

### Cache Configuration
- **TTL**: 30 seconds
- **Cache Key**: `wallet:balance:{walletAddress}`
- **Scope**: Per wallet address

### Cache Invalidation
Cache is invalidated when:
- A successful token transfer occurs (both sender and recipient)
- Balance is updated (deposit, withdrawal, etc.)

## Performance Impact
| Scenario | Without Cache | With Cache |
|----------|---------------|------------|
| First request | 200-800ms | 200-800ms + cache write |
| Subsequent requests | 200-800ms | ~1ms |

## Environment Variables
