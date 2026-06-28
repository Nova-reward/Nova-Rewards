import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required, allow access
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        error: 'Forbidden',
        code: 'INSUFFICIENT_ROLE',
        message: 'Authentication required',
      });
    }

    const userRole = user.role; // Role from JWT payload

    if (!userRole) {
      throw new ForbiddenException({
        error: 'Forbidden',
        code: 'INSUFFICIENT_ROLE',
        message: 'User has no role assigned',
      });
    }

    // Check if user has any of the required roles
    const hasRequiredRole = requiredRoles.some((role) => userRole === role);

    if (!hasRequiredRole) {
      throw new ForbiddenException({
        error: 'Forbidden',
        code: 'INSUFFICIENT_ROLE',
        message: `Required roles: ${requiredRoles.join(', ')}. Current role: ${userRole}`,
      });
    }

    return true;
  }
}
