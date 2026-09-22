import { existsSync, readFileSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

import { AUTH_DIR, USER_FILE, loadEnvLocal, type TestUser } from "./env";

// Remove a conta descartável (os dados dela saem junto, em cascata) e a sessão salva.
export default async function globalTeardown() {
  loadEnvLocal();
  if (existsSync(USER_FILE)) {
    const user = JSON.parse(readFileSync(USER_FILE, "utf8")) as TestUser;
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) console.error(`⚠️  Não foi possível remover o usuário de teste ${user.email}: ${error.message}`);
  }
  rmSync(AUTH_DIR, { recursive: true, force: true });
}
