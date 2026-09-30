import { join } from 'path';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PartsModule } from '../parts/parts.module';
import { CategoriesModule } from '../categories/categories.module';
import { TagsModule } from '../tags/tags.module';
import { AttributesModule } from '../attributes/attributes.module';
import { UnitsModule } from '../units/units.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/admin',
      exclude: ['/api/{*any}'],
    }),
    PartsModule,
    CategoriesModule,
    TagsModule,
    AttributesModule,
    UnitsModule,
    StockModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
