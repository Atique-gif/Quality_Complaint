#!/usr/bin/env node
/**
 * Production startup wrapper
 * 1. Runs database migrations (safe to run repeatedly — uses IF NOT EXISTS)
 * 2. Starts the main server
 *
 * Set SKIP_MIGRATE=1 to bypass migrations for emergency restarts when the DB
 * is temporarily unavailable but tables already exist.
 */

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("=== QMS Complaint Dashboard — Starting ===");

if (process.env.SKIP_MIGRATE === "1") {
  console.log("SKIP_MIGRATE=1 — skipping database migrations");
} else {
  console.log("Running database migrations...");
  try {
    execSync("node migrate.mjs", {
      cwd: __dirname,
      stdio: "inherit",
      env: process.env,
    });
    console.log("✓ Migrations complete");
  } catch (err) {
    console.error("✗ Migration failed:", err.message);
    console.error("Aborting startup. Set SKIP_MIGRATE=1 to bypass if tables already exist.");
    process.exit(1);
  }
}

console.log("Starting server...");
await import(path.join(__dirname, "server.mjs"));
