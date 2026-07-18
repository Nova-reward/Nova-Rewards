import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from '../webhook.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Webhook } from '../webhook.entity';
import { WebhookDelivery } from '../webhook-delivery.entity';

describe('WebhookService', () => {
  let service: WebhookService;

  const mockWebhookRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };

  const mockDeliveryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: getRepositoryToken(Webhook),
          useValue: mockWebhookRepository,
        },
        {
          provide: getRepositoryToken(WebhookDelivery),
          useValue: mockDeliveryRepository,
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerWebhook', () => {
    it('should register a new webhook', async () => {
      const mockWebhook = {
        id: '123',
        merchantId: 'merchant123',
        url: 'https://example.com/webhook',
        secret: 'secret123',
        isActive: true,
      };

      mockWebhookRepository.count.mockResolvedValue(0);
      mockWebhookRepository.create.mockReturnValue(mockWebhook);
      mockWebhookRepository.save.mockResolvedValue(mockWebhook);

      const result = await service.registerWebhook(
        'merchant123',
        'https://example.com/webhook',
      );

      expect(result).toEqual(mockWebhook);
      expect(mockWebhookRepository.count).toHaveBeenCalled();
    });

    it('should throw error if more than 5 webhooks', async () => {
      mockWebhookRepository.count.mockResolvedValue(5);

      await expect(
        service.registerWebhook('merchant123', 'https://example.com/webhook'),
      ).rejects.toThrow('Maximum of 5 webhook URLs allowed');
    });

    it('should throw error for invalid URL', async () => {
      mockWebhookRepository.count.mockResolvedValue(0);

      await expect(
        service.registerWebhook('merchant123', 'invalid-url'),
      ).rejects.toThrow('Invalid URL format');
    });
  });
});
