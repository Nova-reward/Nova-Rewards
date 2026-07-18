import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from '../admin.controller';
import { UserService } from '../../users/user.service';

describe('AdminController', () => {
  let controller: AdminController;
  let userService: UserService;

  const mockUserService = {
    freezeUser: jest.fn(),
    unfreezeUser: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    userService = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('freezeUser', () => {
    it('should freeze a user and return success message', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        isFrozen: true,
        frozenReason: 'Fraud suspicion',
      };
      
      mockUserService.freezeUser.mockResolvedValue(mockUser);

      const result = await controller.freezeUser(
        '123',
        { reason: 'Fraud suspicion' },
        { user: { userId: 'admin123' } },
      );

      expect(result.success).toBe(true);
      expect(result.user.isFrozen).toBe(true);
      expect(mockUserService.freezeUser).toHaveBeenCalled();
    });
  });

  describe('unfreezeUser', () => {
    it('should unfreeze a user and return success message', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        isFrozen: false,
      };

      mockUserService.unfreezeUser.mockResolvedValue(mockUser);

      const result = await controller.unfreezeUser(
        '123',
        { user: { userId: 'admin123' } },
      );

      expect(result.success).toBe(true);
      expect(result.user.isFrozen).toBe(false);
      expect(mockUserService.unfreezeUser).toHaveBeenCalled();
    });
  });
});
