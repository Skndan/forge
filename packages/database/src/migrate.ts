export interface Migration {
  version: string;
  name: string;
  sql: string;
}

export interface MigrationRecord {
  version: string;
  name: string;
  applied_at: Date;
  checksum: string;
}

export interface MigrationOptions {
  postgresUrl: string;
  migrationsDir: string;
}

export async function runMigrations(opts: MigrationOptions): Promise<void> {
  const { postgresUrl, migrationsDir } = opts;

  // Dynamic import of postgres
  const postgres = (await import('postgres')).default;
  const sql = postgres(postgresUrl);

  // Read migration files
  const fs = await import('fs');
  const path = await import('path');

  // Ensure migrations tracking table exists
  await sql`
    CREATE TABLE IF NOT EXISTS forge._migrations (
      version   TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      checksum  TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Get already-applied migrations
  const applied = await sql<MigrationRecord[]>`
    SELECT version, name, checksum, applied_at
    FROM forge._migrations
    ORDER BY version
  `;
  const appliedVersions = new Set(applied.map((r: MigrationRecord) => r.version));

  // Read migration files sorted
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f: string) => f.endsWith('.sql'))
    .sort();

  let count = 0;

  for (const file of files) {
    const version = file.split('_')[0];
    if (!version || appliedVersions.has(version)) continue;

    const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const crypto = await import('crypto');
    const checksum = crypto.createHash('sha256').update(sqlContent).digest('hex');

    console.log(`  ⏳ Applying migration ${file}...`);

    try {
      // Run in transaction
      await sql.begin(async (tx) => {
        await tx.unsafe(sqlContent);
        await tx`
          INSERT INTO forge._migrations (version, name, checksum)
          VALUES (${version}, ${file}, ${checksum})
        `;
      });

      console.log(`  ✅ Applied ${file}`);
      count++;
    } catch (err) {
      console.error(`  ❌ Failed ${file}:`, err);
      throw err;
    }
  }

  if (count === 0) {
    console.log('  No pending migrations.');
  } else {
    console.log(`  Applied ${count} migration(s).`);
  }

  await sql.end();
}
