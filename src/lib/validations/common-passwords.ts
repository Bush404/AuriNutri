/**
 * Bloqueio de senhas triviais — Fase 11, Bloco A (dados de saúde exigem mais
 * que "só não deixar em branco"). Cobre as senhas mais reutilizadas em
 * qualquer lista pública de vazamentos, em português e inglês.
 *
 * Isto é só a camada de UX (feedback imediato no formulário) — a defesa de
 * verdade contra senha vazada é o "Leaked password protection" do Supabase
 * Auth (checa contra a base do HaveIBeenPwned via k-anonymity, muito mais
 * completa que qualquer lista fixa aqui), que precisa ser ligado no painel
 * do Supabase, não dá pra configurar por código. Ver MASTER_DEVELOPMENT_PLAN.md,
 * Fase 11, Bloco A.
 */
const COMMON_PASSWORDS = new Set(
  [
    "123456",
    "12345678",
    "123456789",
    "1234567890",
    "12345",
    "1234567",
    "111111",
    "000000",
    "123123",
    "1q2w3e4r",
    "qwerty",
    "qwerty123",
    "abc123",
    "password",
    "password1",
    "senha123",
    "senha1234",
    "minhasenha",
    "letmein",
    "iloveyou",
    "welcome",
    "welcome1",
    "admin",
    "admin123",
    "administrador",
    "brasil123",
    "brasil1234",
    "vitoria123",
    "12345678910",
    "asdfghjk",
    "asdf1234",
    "trustno1",
    "sunshine",
    "master",
    "dragon",
    "monkey",
    "football",
    "shadow",
    "michael",
    "superman",
    "batman",
    "senha",
    "teste123",
    "teste1234",
    "mudar123",
    "mudar1234",
  ].map((p) => p.toLowerCase())
);

/** Compara em minúsculas — "Senha123" e "senha123" contam como a mesma senha comum. */
export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}
