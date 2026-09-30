import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttributeDefinition } from './entities/attribute-definition.entity';
import { AttributeOption } from './entities/attribute-option.entity';
import { AttributeValueHistory } from './entities/attribute-value-history.entity';
import { Unit } from '../units/entities/unit.entity';
import { Part } from '../parts/entities/part.entity';
import { ActorsModule } from '../actors/actors.module';
import { AttributeDefinitionsService } from './services/attributes-definition.service';
import { AttributesValidationService } from './services/attributes-validation.service';
import { AttributeHistoryService } from './services/attribute-history.service';
import { AttributesController } from './attributes.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttributeDefinition,
      AttributeOption,
      Unit,
      AttributeValueHistory,
      Part,
    ]),
    ActorsModule,
  ],
  controllers: [AttributesController],
  providers: [
    AttributeDefinitionsService,
    AttributesValidationService,
    AttributeHistoryService,
  ],
  exports: [
    AttributeDefinitionsService,
    AttributesValidationService,
    AttributeHistoryService,
    TypeOrmModule,
  ],
})
export class AttributesModule {}
