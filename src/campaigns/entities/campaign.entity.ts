import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Merchant } from '../../merchants/entities/merchant.entity';

@Entity('campaigns')
@Index(['status', 'createdAt'])
@Index(['merchantId', 'status'])
@Index(['startDate', 'endDate'])
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @ManyToOne(() => Merchant)
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @Column({ type: 'enum', enum: ['draft', 'active', 'paused', 'completed', 'cancelled'], default: 'draft' })
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';

  @Column({ name: 'reward_amount', type: 'decimal', precision: 20, scale: 7 })
  rewardAmount: string;

  @Column({ name: 'total_budget', type: 'decimal', precision: 20, scale: 7 })
  totalBudget: string;

  @Column({ name: 'remaining_budget', type: 'decimal', precision: 20, scale: 7 })
  remainingBudget: string;

  @Column({ name: 'start_date', type: 'timestamp' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp' })
  endDate: Date;

  @Column({ name: 'max_claims', type: 'int', nullable: true })
  maxClaims?: number;

  @Column({ name: 'total_claims', type: 'int', default: 0 })
  totalClaims: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
