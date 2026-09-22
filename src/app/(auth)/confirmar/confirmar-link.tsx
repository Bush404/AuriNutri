"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { CONFIRMACOES, type ConfirmacaoTipo } from "@/lib/auth-confirm";
import { Button } from "@/components/ui/button";

export function ConfirmarLink({ tokenHash, tipo }: { tokenHash: string; tipo: ConfirmacaoTipo | null }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(tokenHash && tipo ? null : "Link inválido.");
  const [isPending, startTransition] = useTransition();
  const info = CONFIRMACOES[tipo ?? "email"];

  function handleContinuar() {
    if (!tipo) return;
    setErro(null);
    startTransition(async () => {
      // Confirmado no navegador: a sessão nasce direto nos cookies que a próxima
      // tela (ex.: /redefinir-senha, que usa o cliente do navegador) vai ler.
      const { error } = await createClient().auth.verifyOtp({ token_hash: tokenHash, type: tipo });
      if (error) {
        setErro("Este link é inválido ou já expirou.");
        return;
      }
      router.push(info.destino);
      router.refresh();
    });
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">{info.titulo}</h2>

      {erro ? (
        <>
          <p className="mt-3 text-sm text-destructive" role="alert">
            {erro} Links de e-mail valem por tempo limitado e só podem ser usados uma vez.
          </p>
          <Link href={info.novoLink.href} className="mt-6 inline-block text-sm font-medium text-primary-700 hover:underline">
            {info.novoLink.texto}
          </Link>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">{info.descricao}</p>
          <Button type="button" className="mt-8 w-full" onClick={handleContinuar} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {info.botao}
          </Button>
        </>
      )}
    </div>
  );
}
