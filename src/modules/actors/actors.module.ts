import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Actor } from './entities/actor.entity';
import { ActorsService } from './services/actors.service';

@Module({
  imports: [TypeOrmModule.forFeature([Actor])],
  providers: [ActorsService],
  exports: [ActorsService, TypeOrmModule],
})
export class ActorsModule {}
