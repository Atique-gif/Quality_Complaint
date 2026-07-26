#!/usr/bin/env node
/**
 * QMS Database Migration Runner
 * Run ONCE after deployment:
 *   DATABASE_URL=postgres://... node migrate.mjs
 */

// Load .env if present (Node 20.6+ supports --env-file; for older use dotenv)
try {
  const { config } = await import("dotenv");
  config();
} catch {}

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

import pg from "pg";
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  console.log("Running database migrations...\n");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      username   TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'Member',
      email      TEXT,
      phone      TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ users");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS complaints (
      id                 SERIAL PRIMARY KEY,
      number             TEXT NOT NULL UNIQUE,
      customer_name      TEXT NOT NULL,
      site               TEXT NOT NULL DEFAULT '',
      contact_person     TEXT,
      received_date      DATE NOT NULL,
      equipment_name     TEXT NOT NULL DEFAULT '',
      model_number       TEXT,
      serial_number      TEXT,
      part_number        TEXT NOT NULL DEFAULT '',
      program_number     TEXT,
      co_number          TEXT,
      defect_quantity    INTEGER NOT NULL DEFAULT 1,
      defect_description TEXT NOT NULL,
      defect_category    TEXT NOT NULL DEFAULT 'Other',
      priority           TEXT NOT NULL DEFAULT 'Medium',
      status             TEXT NOT NULL DEFAULT 'Open',
      project_dri        TEXT,
      build_stage        TEXT,
      raised_by          TEXT,
      created_by         INTEGER REFERENCES users(id),
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ complaints");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS immediate_actions (
      id           SERIAL PRIMARY KEY,
      complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      description  TEXT NOT NULL,
      taken_by     TEXT,
      taken_at     DATE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ immediate_actions");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS root_causes (
      id            SERIAL PRIMARY KEY,
      complaint_id  INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      category      TEXT NOT NULL DEFAULT 'Other',
      description   TEXT NOT NULL,
      identified_by TEXT,
      identified_at DATE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ root_causes");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS capa_tasks (
      id             SERIAL PRIMARY KEY,
      complaint_id   INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      type           TEXT NOT NULL DEFAULT 'Corrective',
      title          TEXT NOT NULL,
      description    TEXT,
      assigned_to    TEXT,
      due_date       DATE,
      completed_date DATE,
      status         TEXT NOT NULL DEFAULT 'Open',
      inspector_id   INTEGER REFERENCES users(id),
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ capa_tasks");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attachments (
      id           SERIAL PRIMARY KEY,
      complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      file_name    TEXT NOT NULL,
      file_size    INTEGER,
      content_type TEXT,
      object_path  TEXT NOT NULL,
      uploaded_by  INTEGER REFERENCES users(id),
      uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ attachments");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS defect_categories (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ defect_categories");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id         SERIAL PRIMARY KEY,
      channel    TEXT NOT NULL UNIQUE,
      config     TEXT NOT NULL DEFAULT '{}',
      enabled    BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ notification_settings");

  // Safe incremental additions
  const alters = [
    "ALTER TABLE complaints ADD COLUMN IF NOT EXISTS project_dri TEXT",
    "ALTER TABLE complaints ADD COLUMN IF NOT EXISTS build_stage TEXT",
    "ALTER TABLE complaints ADD COLUMN IF NOT EXISTS raised_by   TEXT",
    "ALTER TABLE users      ADD COLUMN IF NOT EXISTS email       TEXT",
    "ALTER TABLE users      ADD COLUMN IF NOT EXISTS phone       TEXT",
    "ALTER TABLE capa_tasks ADD COLUMN IF NOT EXISTS inspector_id INTEGER REFERENCES users(id)",
  ];
  for (const sql of alters) await pool.query(sql);
  console.log("✓ Incremental column migrations");

  // Create default admin only if users table is empty
  const { rows } = await pool.query("SELECT COUNT(*) AS c FROM users");
  if (Number(rows[0].c) === 0) {
    // bcrypt hash of 'Admin@1234' — user should change this immediately
    await pool.query(
      "INSERT INTO users (username, password, role) VALUES ($1, $2, $3)",
      ["admin", "CHANGE_ME_HASH_ON_FIRST_LOGIN", "Admin"]
    );
    console.log("\n⚠️  Default admin user created (username: admin).");
    console.log("   Change the password immediately via the app!\n");
  }

  console.log("\n✅ All migrations complete.");
}

run()
  .catch(err => { console.error("Migration failed:", err); process.exit(1); })
  .finally(() => pool.end());
