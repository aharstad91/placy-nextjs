#!/usr/bin/env node
/**
 * Run SQL migrations against Supabase
 * Usage: node run_migration.js <path-to-sql-file>
 */

const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD;
const PROJECT_REF = 'eolzjxkonfwbzjqqvbnj';

if (!DATABASE_PASSWORD) {
  console.error('Missing DATABASE_PASSWORD in .env.local');
  process.exit(1);
}

async function runMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf-8');

  console.log(`Running migration: ${filePath}`);
  console.log(`SQL length: ${sql.length} characters\n`);

  const client = new Client({
    host: 'aws-1-eu-west-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: `postgres.${PROJECT_REF}`,
    password: DATABASE_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const result = await client.query(sql);
    console.log('Migration completed successfully!');
    console.log('Result:', result.command || 'OK');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.log('Usage: node run_migration.js <path-to-sql-file>');
  console.log('Example: node run_migration.js supabase/migrations/006_project_hierarchy_ddl.clean.sql');
  process.exit(1);
}

runMigration(migrationFile);
