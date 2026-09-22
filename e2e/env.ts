import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// O Playwright não lê o .env.local sozinho (o Next.js lê, mas só no servidor dele).
export function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

export const AUTH_DIR = path.join(__dirname, ".auth");
export const USER_FILE = path.join(AUTH_DIR, "user.json");
export const STORAGE_STATE = path.join(AUTH_DIR, "storage-state.json");

export interface TestUser {
  id: string;
  email: string;
  password: string;
}
