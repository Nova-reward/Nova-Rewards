import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Webhook } from './webhook.entity';

@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  webhookId: string;

  @ManyToOne(() => Webhook)
  @JoinColumn({ name: 'webhookId' })
  webhook: Webhook;

  @Column()
  eventType: string; // 'distribution.completed', 'campaign.cap_reached', etc.

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ nullable: true })
  responseStatus: number;

  @Column({ nullable: true, type: 'text' })
  responseBody: string;

  @Column({ nullable: true })
  responseTimeMs: number;

  @Column({ default: 0 })
  attemptCount: number;

  @Column({ default: false })
  success: boolean;

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;
}
