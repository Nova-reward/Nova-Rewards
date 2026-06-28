import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { UserModule } from '../users/user.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [UserModule, AuditModule],
  controllers: [AdminController],
})
export class AdminModule {}
