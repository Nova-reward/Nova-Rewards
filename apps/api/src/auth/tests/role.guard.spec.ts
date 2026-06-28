import { Test, TestingModule } from '@nestjs/testing';
import { RoleGuard } from '../guards/role.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';

describe('RoleGuard', () => {
  let guard: RoleGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleGuard,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RoleGuard>(RoleGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when no roles are required', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'user' } }),
      }),
      getHandler: () => {},
    } as any;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has required role', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(['merchant']);
    
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'merchant' } }),
      }),
      getHandler: () => {},
    } as any;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user has insufficient role', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(['merchant']);
    
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'user' } }),
      }),
      getHandler: () => {},
    } as any;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user is not authenticated', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(['merchant']);
    
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: null }),
      }),
      getHandler: () => {},
    } as any;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
