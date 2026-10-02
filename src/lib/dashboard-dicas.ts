/**
 * "Dica do AuriNutri" do painel (Fase 19): um recurso que já existe, por dia, com
 * link para onde ele mora. Só entra aqui o que está pronto e publicado — nunca
 * prometer função que não roda.
 */
export interface DicaDoPainel {
  titulo: string;
  texto: string;
  acao: string;
  href: string;
}

export const DICAS_DO_PAINEL: DicaDoPainel[] = [
  {
    titulo: "Envie tudo ao paciente de uma vez.",
    texto: "Na Central de Envio da ficha, marque plano, receitas e materiais e mande numa mensagem só.",
    acao: "Abrir pacientes",
    href: "/pacientes",
  },
  {
    titulo: "Compare fórmulas de gasto energético.",
    texto: "São 17 fórmulas, lado a lado, para escolher a que faz mais sentido para cada paciente.",
    acao: "Abrir pacientes",
    href: "/pacientes",
  },
  {
    titulo: "Transforme um plano em modelo.",
    texto: "Favorite um plano bem montado e reutilize como ponto de partida para outros pacientes.",
    acao: "Ver planos",
    href: "/planos",
  },
  {
    titulo: "Gere a lista de compras do plano.",
    texto: "O AuriNutri soma os alimentos do plano e monta a lista pronta para o paciente.",
    acao: "Ver planos",
    href: "/planos",
  },
  {
    titulo: "Agende um pacote de consultas.",
    texto: "Várias sessões com uma cobrança só: use \"Novo pacote\" na agenda.",
    acao: "Abrir agenda",
    href: "/agenda",
  },
  {
    titulo: "Suas receitas, já calculadas.",
    texto: "Cadastre a receita uma vez e o AuriNutri calcula os nutrientes por porção.",
    acao: "Ver receitas",
    href: "/receitas",
  },
  {
    titulo: "Seus materiais num lugar só.",
    texto: "Guarde orientações e PDFs na Biblioteca e envie para o paciente quando precisar.",
    acao: "Abrir biblioteca",
    href: "/biblioteca",
  },
];

/** Mesma dica o dia inteiro; muda à meia-noite (no fuso do profissional). */
export function dicaDoDia(hojeStr: string): DicaDoPainel {
  const dias = Math.floor(Date.parse(`${hojeStr}T00:00:00Z`) / 86_400_000);
  return DICAS_DO_PAINEL[((dias % DICAS_DO_PAINEL.length) + DICAS_DO_PAINEL.length) % DICAS_DO_PAINEL.length];
}
