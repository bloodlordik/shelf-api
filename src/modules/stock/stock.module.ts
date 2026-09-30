import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockMovement } from './entities/stock-movement.entity';
import { Part } from '../parts/entities/part.entity';
import { ActorsModule } from '../actors/actors.module';
import { StockMovementsService } from './services/stock-movements.service';
import { StockMovementsController } from './stock-movements.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StockMovement, Part]), ActorsModule],
  controllers: [StockMovementsController],
  providers: [StockMovementsService],
  exports: [StockMovementsService, TypeOrmModule],
})
export class StockModule {}
