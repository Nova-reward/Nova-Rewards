import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CampaignsService } from '../campaigns.service';
import { Campaign } from '../entities/campaign.entity';
import { BadRequestException } from '@nestjs/common';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        {
          provide: getRepositoryToken(Campaign),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const mockCampaigns = [{ id: '1', title: 'Test Campaign' }];
      mockRepository.findAndCount.mockResolvedValue([mockCampaigns, 1]);

      const result = await service.findAll({ page: 1, pageSize: 20 });
      
      expect(result.data).toEqual(expect.any(Array));
      expect(result.pagination).toHaveProperty('page', 1);
      expect(result.pagination).toHaveProperty('total', 1);
    });

    it('should filter by status', async () => {
      await service.findAll({ status: 'active', page: 1, pageSize: 20 });
      
      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'active' }),
        })
      );
    });

    it('should filter by merchantId', async () => {
      await service.findAll({ merchantId: 'merchant-123', page: 1, pageSize: 20 });
      
      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ merchantId: 'merchant-123' }),
        })
      );
    });

    it('should order by createdAt DESC', async () => {
      await service.findAll({ page: 1, pageSize: 20 });
      
      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC' },
        })
      );
    });
  });
});
