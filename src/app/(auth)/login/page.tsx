"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// `useSearchParams()` obriga o componente a renderizar no cliente. Sem um
// limite de Suspense acima dele, o `next build` falha ao tentar pré-renderizar
// esta página ("useSearchParams() should be wrapped in a suspense boundary").
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        toast.error("Não foi possível entrar", {
          description:
            error.message === "Invalid login credentials"
              ? "E-mail ou senha incorretos."
              : error.message,
        });
        return;
      }

      const redirectTo = searchParams.get("redirectTo") || "/dashboard";
      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      // Sem este catch, uma exceção (ex.: configuração ausente do Supabase)
      // deixaria o botão travado em "carregando" para sempre.
      toast.error("Erro inesperado ao entrar", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">Bem-vindo de volta</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Entre com sua conta para acessar seus pacientes.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" placeholder="voce@exemplo.com" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link href="/esqueci-senha" className="text-xs font-medium text-primary-700 hover:underline">
              Esqueceu a senha?
            </Link>
          </div>
          <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Entrar
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Ainda não tem uma conta?{" "}
        <Link href="/cadastro" className="font-medium text-primary-700 hover:underline">
          Cadastre-se gratuitamente
        </Link>
      </p>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">Bem-vindo de volta</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Entre com sua conta para acessar seus pacientes.
      </p>
      <div className="mt-8 flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginForm />
    </Suspense>
  );
}
