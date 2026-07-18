import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { UserService } from '../../users/user.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get the full user from the database to check role
    const dbUser = await this.userService.findById(user.userId);

    if (dbUser.role !== 'admin') {
      throw new ForbiddenException('Admin role required for this action');
    }

    return true;
  }
}
