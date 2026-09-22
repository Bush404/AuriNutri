import { existsSync, readFileSync, rmSync } from "node:fs";

import { AUTH_DIR, USER_FILE, loadEnvLocal, type TestUser } from "./env";
import { adminClient } from "./helpers";

/**
 * Remove a conta descartável e a sessão salva. Apaga os pacientes antes da conta
 * (a cascata leva o resto ligado a eles): sem a migration 0035, a exclusão
 * direta da conta falha quando ela tem pacientes — o gatilho de auditoria tenta
 * registrar o dono que está sendo apagado.
 */
export default async function globalTeardown() {
  loadEnvLocal();
  if (existsSync(USER_FILE)) {
    const user = JSON.parse(readFileSync(USER_FILE, "utf8")) as TestUser;
    const admin = adminClient();
    await admin.from("patients").delete().eq("user_id", user.id);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw new Error(`Não foi possível remover o usuário de teste ${user.email}: ${error.message}`);
  }
  rmSync(AUTH_DIR, { recursive: true, force: true });
}
