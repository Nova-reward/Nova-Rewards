import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  async log(
    action: string,
    userId: string,
    adminId: string,
    reason?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const log = this.auditRepository.create({
      action,
      userId,
      adminId,
      reason,
      metadata,
    });
    await this.auditRepository.save(log);
  }

  async getAuditLogs(userId?: string): Promise<AuditLog[]> {
    const query = this.auditRepository.createQueryBuilder('audit');
    if (userId) {
      query.where('audit.userId = :userId', { userId });
    }
    return query.orderBy('audit.createdAt', 'DESC').getMany();
  }
}
