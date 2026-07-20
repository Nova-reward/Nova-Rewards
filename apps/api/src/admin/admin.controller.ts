import { Controller, Post, Param, Body, UseGuards, Patch, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '../users/user.service';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString, IsOptional } from 'class-validator';

class FreezeUserDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('admin')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(private readonly userService: UserService) {}

  @Post(':id/freeze')
  @ApiOperation({ summary: 'Freeze a user account' })
  @ApiResponse({
    status: 200,
    description: 'User frozen successfully',
  })
  @ApiResponse({ status: 400, description: 'User already frozen' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async freezeUser(
    @Param('id') userId: string,
    @Body() body: FreezeUserDto,
    @Request() req: any,
  ) {
    const adminId = req.user.userId;
    const user = await this.userService.freezeUser(userId, adminId, body.reason);
    
    return {
      success: true,
      message: `User ${user.email} has been frozen`,
      user: {
        id: user.id,
        email: user.email,
        isFrozen: user.isFrozen,
        frozenReason: user.frozenReason,
        frozenAt: user.frozenAt,
      },
    };
  }

  @Post(':id/unfreeze')
  @ApiOperation({ summary: 'Unfreeze a user account' })
  @ApiResponse({
    status: 200,
    description: 'User unfrozen successfully',
  })
  @ApiResponse({ status: 400, description: 'User is not frozen' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async unfreezeUser(
    @Param('id') userId: string,
    @Request() req: any,
  ) {
    const adminId = req.user.userId;
    const user = await this.userService.unfreezeUser(userId, adminId);
    
    return {
      success: true,
      message: `User ${user.email} has been unfrozen`,
      user: {
        id: user.id,
        email: user.email,
        isFrozen: user.isFrozen,
      },
    };
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Update user role (admin/user)' })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateRole(
    @Param('id') userId: string,
    @Body('role') role: string,
  ) {
    if (!['user', 'admin'].includes(role)) {
      throw new BadRequestException('Role must be either "user" or "admin"');
    }

    const user = await this.userService.updateRole(userId, role);
    
    return {
      success: true,
      message: `User ${user.email} role updated to ${role}`,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
