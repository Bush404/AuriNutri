import { z } from "zod";
import { isCommonPassword } from "@/lib/validations/common-passwords";

export const loginSchema = z.object({
  email: z.string().min(1, "Informe seu e-mail").email("E-mail inválido"),
  password: z.string().min(1, "Informe sua senha"),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Mínimo 8 caracteres + bloqueio de senha comum (Fase 11, Bloco A — dado de
 * saúde exige mais que o mínimo de 6 caracteres de antes). Isto é só a
 * validação de UX no formulário; a autoridade de verdade é a configuração
 * de senha no painel do Supabase Auth (comprimento mínimo + "Leaked password
 * protection") — sem isso, esta validação é só um aviso educado, contornável
 * por qualquer chamada direta à API do Supabase.
 */
const strongPasswordSchema = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres")
  .refine((value) => !isCommonPassword(value), "Essa senha é muito comum e fácil de adivinhar — escolha outra");

export const registerSchema = z
  .object({
    nome: z.string().min(2, "Informe seu nome completo"),
    email: z.string().min(1, "Informe seu e-mail").email("E-mail inválido"),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Confirme sua senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Informe seu e-mail").email("E-mail inválido"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Confirme sua senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
