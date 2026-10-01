"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ActionResult } from "@/lib/actions/patients";

export type EstadoSalvamento = "salvo" | "pendente" | "salvando" | "erro";

/**
 * Salva sozinho: um tempo depois da última alteração em `valores`, chama
 * `salvar`. Nunca roda dois salvamentos ao mesmo tempo — o que mudar durante
 * um salvamento entra no seguinte. `salvarAgora()` não espera o atraso (para o
 * botão "Salvar e voltar") e devolve null se tudo ficou gravado, ou o motivo do erro.
 */
export function useAutoSave<T>(valores: T, salvar: (valores: T) => Promise<ActionResult>, atrasoMs = 1000) {
  const chave = JSON.stringify(valores);
  const salvoRef = useRef(chave);
  const valoresRef = useRef(valores);
  const salvarRef = useRef(salvar);
  // Antes do efeito do atraso (abaixo), para ele sempre ver os valores atuais.
  useEffect(() => {
    valoresRef.current = valores;
    salvarRef.current = salvar;
  });
  const emAndamento = useRef<Promise<boolean> | null>(null);
  const erroRef = useRef<string | null>(null);

  const [estado, setEstado] = useState<EstadoSalvamento>("salvo");
  const [erro, setErro] = useState<string | null>(null);

  const executar = useCallback(async (): Promise<boolean> => {
    // Um por vez: espera o atual e confere de novo se ainda há o que salvar.
    while (emAndamento.current) await emAndamento.current;
    const atual = valoresRef.current;
    const chaveAtual = JSON.stringify(atual);
    if (chaveAtual === salvoRef.current) return true;

    setEstado("salvando");
    const tarefa = (async () => {
      try {
        const r = await salvarRef.current(atual);
        if (!r.success) {
          erroRef.current = r.message ?? "Não foi possível salvar.";
          setErro(erroRef.current);
          setEstado("erro");
          return false;
        }
        salvoRef.current = chaveAtual;
        erroRef.current = null;
        setErro(null);
        setEstado(JSON.stringify(valoresRef.current) === chaveAtual ? "salvo" : "pendente");
        return true;
      } catch {
        erroRef.current = "Sem conexão. Tentando de novo na próxima alteração.";
        setErro(erroRef.current);
        setEstado("erro");
        return false;
      }
    })();
    emAndamento.current = tarefa;
    try {
      return await tarefa;
    } finally {
      emAndamento.current = null;
    }
  }, []);

  useEffect(() => {
    if (chave === salvoRef.current) return;
    setEstado((e) => (e === "salvando" ? e : "pendente"));
    const t = setTimeout(() => void executar(), atrasoMs);
    return () => clearTimeout(t);
  }, [chave, atrasoMs, executar]);

  const salvarAgora = useCallback(async (): Promise<string | null> => {
    let ok = await executar();
    // Algo pode ter mudado durante o salvamento: grava também.
    if (ok && JSON.stringify(valoresRef.current) !== salvoRef.current) ok = await executar();
    return ok ? null : erroRef.current ?? "Não foi possível salvar.";
  }, [executar]);

  return { estado, erro, salvarAgora };
}
