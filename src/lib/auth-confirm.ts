/**
 * Links de e-mail do Supabase (confirmação de cadastro e redefinição de senha)
 * no formato `token_hash`: o link abre /confirmar e só é "gasto" quando a
 * pessoa clica em Continuar (verifyOtp no navegador, com o cliente do Supabase do
 * browser — assim a sessão já nasce nos cookies que /redefinir-senha lê).
 *
 * Por quê: no formato antigo (/auth/callback?code=...), o link era consumido
 * na primeira abertura — e filtros de e-mail (Outlook/Hotmail "Safe Links")
 * abrem os links sozinhos para checar, gastando-o antes da pessoa ("otp_expired").
 * Além disso, o formato por code exigia o mesmo navegador do pedido (PKCE); o
 * token_hash funciona em qualquer aparelho.
 *
 * O destino depois da confirmação é decidido aqui pelo tipo — nunca por um
 * parâmetro da URL — para o link não poder ser usado como redirecionamento aberto.
 */

export type ConfirmacaoTipo = "recovery" | "email";

export interface ConfirmacaoInfo {
  destino: string;
  titulo: string;
  descricao: string;
  botao: string;
  novoLink: { href: string; texto: string };
}

export const CONFIRMACOES: Record<ConfirmacaoTipo, ConfirmacaoInfo> = {
  recovery: {
    destino: "/redefinir-senha",
    titulo: "Redefinir sua senha",
    descricao: "Clique em continuar para criar uma nova senha para sua conta.",
    botao: "Continuar",
    novoLink: { href: "/esqueci-senha", texto: "Pedir um novo link" },
  },
  email: {
    destino: "/dashboard",
    titulo: "Confirmar seu e-mail",
    descricao: "Clique em continuar para ativar sua conta no AuriNutri.",
    botao: "Continuar",
    novoLink: { href: "/login", texto: "Ir para o login" },
  },
};

/** Aceita os tipos que o Supabase usa nos modelos; "signup" é tratado como "email". */
export function tipoDeConfirmacao(valor: string | undefined | null): ConfirmacaoTipo | null {
  if (valor === "recovery") return "recovery";
  if (valor === "email" || valor === "signup") return "email";
  return null;
}
