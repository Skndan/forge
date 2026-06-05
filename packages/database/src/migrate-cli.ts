#!/usr/bin/env bun
// Migration CLI runner
import { runMigrations } from './migrate.js';

const postgresUrl = process.env.POSTGRES_URL;
if (!postgresUrl) {
  console.error('❌ POSTGRES_URL environment variable is required');
  process.exit(1);
}

const migrationsDir = process.env.MIGRATIONS_DIR || './migrations';

async function main() {
  console.log('🚀 Forge — Database Migrations');
  console.log('==============================\n');

  await runMigrations({
    postgresUrl,
    migrationsDir,
  });

  console.log('\n✅ Migrations complete!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
