import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from '../../src/wallet/wallet.service';
import { RedisService } from '../../src/redis/redis.service';

describe('WalletService with Redis Caching', () => {
  let service: WalletService;
  let redisService: RedisService;

  const mockWalletAddress = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  const mockBalance = '100.00';

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    redisService = module.get<RedisService>(RedisService);
  });

  it('should return cached balance on cache hit', async () => {
    mockRedisService.get.mockResolvedValue(mockBalance);

    const result = await service.getBalance(mockWalletAddress);

    expect(result).toBe(mockBalance);
    expect(mockRedisService.get).toHaveBeenCalled();
  });

  it('should fetch from Horizon on cache miss', async () => {
    mockRedisService.get.mockResolvedValue(null);
    mockRedisService.set.mockResolvedValue(true);

    const result = await service.getBalance(mockWalletAddress);

    expect(result).toBe('100.00');
    expect(mockRedisService.set).toHaveBeenCalled();
  });

  it('should invalidate cache for a wallet', async () => {
    mockRedisService.delete.mockResolvedValue(true);

    await service.invalidateCache(mockWalletAddress);

    expect(mockRedisService.delete).toHaveBeenCalled();
  });
});
