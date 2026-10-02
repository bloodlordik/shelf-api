import fs from 'node:fs';
import path from 'node:path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Actor } from '../modules/actors/entities/actor.entity';
import { AttributeDefinition } from '../modules/attributes/entities/attribute-definition.entity';
import { AttributeOption } from '../modules/attributes/entities/attribute-option.entity';
import { AttributeValueHistory } from '../modules/attributes/entities/attribute-value-history.entity';
import { Category } from '../modules/categories/entities/category.entity';
import { AttributeValue } from '../modules/parts/entities/attribute-value.entity';
import { Part } from '../modules/parts/entities/part.entity';
import { StockMovement } from '../modules/stock/entities/stock-movement.entity';
import { Tag } from '../modules/tags/entities/tag.entity';
import { Unit } from '../modules/units/entities/unit.entity';

function loadEnvFileSafe(filePath: string): void {
  if (!fs.existsSync(filePath)) return;

  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(filePath);
      return;
    } catch {
      // Fallback to manual line parser
    }
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx !== -1) {
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!(key in process.env)) {
          process.env[key] = val;
        }
      }
    }
  } catch {
    // Ignore environment file read errors
  }
}

const nodeEnv = process.env.NODE_ENV || 'development';
const envFiles = [
  path.resolve(process.cwd(), `.env.${nodeEnv}.local`),
  path.resolve(process.cwd(), `.env.${nodeEnv}`),
  path.resolve(process.cwd(), '.env'),
];

for (const envFile of envFiles) {
  loadEnvFileSafe(envFile);
}

export const entities = [
  Actor,
  Unit,
  Category,
  Tag,
  AttributeDefinition,
  AttributeOption,
  AttributeValueHistory,
  Part,
  AttributeValue,
  StockMovement,
];

const migrationsPattern = path
  .join(__dirname, 'migrations', '*{.ts,.js}')
  .replace(/\\/g, '/');

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database:
    process.env.DB_DATABASE ||
    (nodeEnv === 'production' ? 'shelf_prod_db' : 'shelf_dev_db'),
  synchronize: false,
  logging:
    process.env.NODE_ENV === 'development' || process.env.DB_LOGGING === 'true',
  entities,
  migrations: [migrationsPattern],
  migrationsTableName: 'typeorm_migrations',
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
