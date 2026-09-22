"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordInput) {
    setLoading(true);

    try {
      const supabase = createClient();

      // Nesta etapa o usuário já está autenticado temporariamente via
      // o link de recuperação (sessão criada pelo /auth/callback).
      const { error } = await supabase.auth.updateUser({ password: values.password });

      if (error) {
        toast.error("Não foi possível redefinir sua senha", { description: error.message });
        return;
      }

      toast.success("Senha atualizada com sucesso!");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error("Erro inesperado ao redefinir a senha", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground">Criar nova senha</h2>
      <p className="mt-1 text-sm text-muted-foreground">Escolha uma nova senha para sua conta.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <Input id="password" type="password" placeholder="Mínimo 8 caracteres" aria-required="true" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive" role="alert">{errors.password.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
          <Input id="confirmPassword" type="password" placeholder="••••••••" aria-required="true" {...register("confirmPassword")} />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive" role="alert">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar nova senha
        </Button>
      </form>
    </div>
  );
}
