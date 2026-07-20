import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MerchantModule } from './merchant/merchant.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        ssl: configService.get('DATABASE_SSL') === 'true',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    MerchantModule,
    WalletModule,
  ],
})
export class AppModule {}
