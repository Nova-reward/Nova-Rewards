import { Module } from '@nestjs/common';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';

@Module({
  controllers: [MerchantController],
  providers: [MerchantService],
})
export class MerchantModule {}
