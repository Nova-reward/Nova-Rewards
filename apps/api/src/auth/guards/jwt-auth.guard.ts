import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from '../../users/user.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly userService: UserService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First, validate the JWT
    const isValid = await super.canActivate(context);
    if (!isValid) {
      throw new UnauthorizedException('Invalid token');
    }

    // Then check if the user is frozen
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user && user.userId) {
      const isFrozen = await this.userService.checkIfFrozen(user.userId);
      if (isFrozen) {
        throw new UnauthorizedException({
          code: 'ACCOUNT_FROZEN',
          message: 'Your account has been frozen. Please contact support.',
        });
      }
    }

    return true;
  }
}
