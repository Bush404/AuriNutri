"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { nome: values.nome },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        },
      });

      if (error) {
        toast.error("Não foi possível criar sua conta", { description: error.message });
        return;
      }

      // Se a confirmação de e-mail estiver desativada no projeto Supabase,
      // já existirá uma sessão e podemos ir direto para o dashboard.
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setAccountCreated(true);
    } catch (err) {
      toast.error("Erro inesperado ao criar a conta", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  if (accountCreated) {
    return (
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Verifique seu e-mail</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Enviamos um link de confirmação para o seu e-mail. Clique nele para ativar sua conta e
          fazer login na AuriNutri.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary-700 hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">Crie sua conta</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Comece a organizar seus pacientes em poucos minutos.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome completo</Label>
          <Input id="nome" placeholder="Seu nome" aria-required="true" {...register("nome")} />
          {errors.nome && <p className="text-xs text-destructive" role="alert">{errors.nome.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" placeholder="voce@exemplo.com" aria-required="true" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive" role="alert">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" type="password" placeholder="Mínimo 8 caracteres" aria-required="true" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive" role="alert">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar senha</Label>
          <Input id="confirmPassword" type="password" placeholder="••••••••" aria-required="true" {...register("confirmPassword")} />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive" role="alert">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Criar conta
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Já tem uma conta?{" "}
        <Link href="/login" className="font-medium text-primary-700 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
