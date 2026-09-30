import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate, Environment } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { UnitsModule } from './modules/units/units.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TagsModule } from './modules/tags/tags.module';
import { AttributesModule } from './modules/attributes/attributes.module';
import { PartsModule } from './modules/parts/parts.module';
import { ActorsModule } from './modules/actors/actors.module';
import { StockModule } from './modules/stock/stock.module';
import { McpModule } from './modules/mcp/mcp.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}.local`,
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env',
      ],
      validate,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<Environment>('NODE_ENV');
        const isDev = nodeEnv === Environment.Development;
        const synchronize =
          configService.get<boolean>('DB_SYNCHRONIZE') ?? isDev;
        const logging = isDev;

        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE'),
          synchronize,
          logging,
          autoLoadEntities: true,
        };
      },
    }),
    HealthModule,
    UnitsModule,
    CategoriesModule,
    TagsModule,
    AttributesModule,
    PartsModule,
    ActorsModule,
    StockModule,
    McpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
