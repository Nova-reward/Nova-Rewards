import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCampaignsTable20260101000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        reward_amount DECIMAL(20,7) NOT NULL,
        total_budget DECIMAL(20,7) NOT NULL,
        remaining_budget DECIMAL(20,7) NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        max_claims INT,
        total_claims INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_campaigns_status_created ON campaigns(status, created_at);
      CREATE INDEX idx_campaigns_merchant_status ON campaigns(merchant_id, status);
      CREATE INDEX idx_campaigns_dates ON campaigns(start_date, end_date);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS campaigns`);
  }
}
