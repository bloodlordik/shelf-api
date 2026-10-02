import { spawnSync } from 'node:child_process';
import path from 'node:path';

const rawArgs = process.argv.slice(2);

if (rawArgs.includes('-h') || rawArgs.includes('--help')) {
  console.log('Usage: pnpm run migration:generate <MigrationName> [options]');
  console.log('Example: pnpm run migration:generate InitialSchema --pretty');
  process.exit(0);
}

const nameIndex = rawArgs.findIndex((arg) => !arg.startsWith('-'));
if (nameIndex === -1) {
  console.error('\x1b[31mError: Migration name is required.\x1b[0m');
  console.error('Usage: pnpm run migration:generate <MigrationName> [options]');
  console.error('Example: pnpm run migration:generate InitialSchema --pretty');
  process.exit(1);
}

const migrationName = rawArgs[nameIndex];
const extraArgs = rawArgs.filter((_, idx) => idx !== nameIndex);

let targetPath = migrationName;
if (
  !targetPath.replace(/\\/g, '/').includes('src/database/migrations') &&
  !targetPath.replace(/\\/g, '/').startsWith('migrations/')
) {
  targetPath = path
    .join('src', 'database', 'migrations', migrationName)
    .replace(/\\/g, '/');
}

const dataSourcePath = path
  .join('src', 'database', 'data-source.ts')
  .replace(/\\/g, '/');

const command = 'pnpm';
const cliArgs = [
  'exec',
  'typeorm-ts-node-commonjs',
  'migration:generate',
  targetPath,
  '-d',
  dataSourcePath,
  ...extraArgs,
];

console.log(
  `\x1b[36m> Generating migration at: ${targetPath} using ${dataSourcePath}\x1b[0m`,
);

const result = spawnSync(command, cliArgs, {
  stdio: 'inherit',
  shell: true,
});

if (result.status !== null) {
  process.exit(result.status);
}
