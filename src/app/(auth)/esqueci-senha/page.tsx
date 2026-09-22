"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/redefinir-senha`,
      });

      if (error) {
        toast.error("Não foi possível enviar o e-mail", { description: error.message });
        return;
      }

      setSent(true);
    } catch (err) {
      toast.error("Erro inesperado ao enviar o e-mail", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
          <MailCheck className="h-6 w-6 text-primary-600" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">E-mail enviado</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Se houver uma conta associada a este e-mail, você receberá um link para redefinir sua senha.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary-700 hover:underline">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">Recuperar senha</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Informe seu e-mail e enviaremos um link para você criar uma nova senha.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" placeholder="voce@exemplo.com" aria-required="true" {...register("email")} />
          {errors.email && <p className="text-xs text-destructive" role="alert">{errors.email.message}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Enviar link de recuperação
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Lembrou a senha?{" "}
        <Link href="/login" className="font-medium text-primary-700 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
