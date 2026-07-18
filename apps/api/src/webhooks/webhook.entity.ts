import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Merchant } from '../merchants/merchant.entity';

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  merchantId: string;

  @ManyToOne(() => Merchant)
  @JoinColumn({ name: 'merchantId' })
  merchant: Merchant;

  @Column()
  url: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  secret: string;

  @Column({ default: 0 })
  failureCount: number;

  @Column({ nullable: true })
  lastDeliveryAt: Date;

  @Column({ nullable: true })
  lastDeliveryStatus: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
