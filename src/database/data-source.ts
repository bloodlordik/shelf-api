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

function loadProductionEnv(): Record<string, string> {
  const prodEnvPath = path.resolve(process.cwd(), '.env.production');

  if (!fs.existsSync(prodEnvPath)) {
    throw new Error(
      'Environment configuration file ".env.production" not found. Migrations must strictly load database settings from ".env.production".',
    );
  }

  const envConfig: Record<string, string> = {};
  const content = fs.readFileSync(prodEnvPath, 'utf-8');

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
      envConfig[key] = val;
      process.env[key] = val;
    }
  }

  return envConfig;
}

const prodEnv = loadProductionEnv();

const requiredKeys = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
] as const;

for (const key of requiredKeys) {
  if (!prodEnv[key]) {
    throw new Error(
      `Missing required database configuration "${key}" in ".env.production".`,
    );
  }
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
  host: prodEnv.DB_HOST,
  port: parseInt(prodEnv.DB_PORT, 10),
  username: prodEnv.DB_USERNAME,
  password: prodEnv.DB_PASSWORD,
  database: prodEnv.DB_DATABASE,
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true' || prodEnv.DB_LOGGING === 'true',
  entities,
  migrations: [migrationsPattern],
  migrationsTableName: 'typeorm_migrations',
};

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
