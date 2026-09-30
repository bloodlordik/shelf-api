import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Part } from './entities/part.entity';
import { AttributeValue } from './entities/attribute-value.entity';
import { Tag } from '../tags/entities/tag.entity';
import { Category } from '../categories/entities/category.entity';
import { StockMovement } from '../stock/entities/stock-movement.entity';
import { AttributesModule } from '../attributes/attributes.module';
import { CategoriesModule } from '../categories/categories.module';
import { TagsModule } from '../tags/tags.module';
import { StockModule } from '../stock/stock.module';
import { PartsService } from './services/parts.service';
import { PartsSnapshotService } from './services/parts-snapshot.service';
import { PartsCardFacade } from './services/parts-card.facade';
import { PartsFilterService } from './services/parts-filter.service';
import { PartsController } from './parts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Part,
      AttributeValue,
      Tag,
      Category,
      StockMovement,
    ]),
    AttributesModule,
    CategoriesModule,
    TagsModule,
    StockModule,
  ],
  controllers: [PartsController],
  providers: [
    PartsService,
    PartsSnapshotService,
    PartsCardFacade,
    PartsFilterService,
  ],
  exports: [
    PartsService,
    PartsSnapshotService,
    PartsCardFacade,
    PartsFilterService,
    TypeOrmModule,
  ],
})
export class PartsModule {}
