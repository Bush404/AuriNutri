import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    // Status: fundo suave + texto forte. success / warning / info / destructive (erro) /
    // neutral. "default" é a etiqueta da marca (verde AuriNutri).
    variants: {
      variant: {
        default: "border-transparent bg-primary-50 text-primary-800",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        accent: "border-transparent bg-warning-soft text-warning",
        outline: "border-border bg-card text-foreground",
        destructive: "border-transparent bg-destructive/10 text-destructive",
        success: "border-transparent bg-success-soft text-success",
        warning: "border-transparent bg-warning-soft text-warning",
        info: "border-transparent bg-info-soft text-info",
        neutral: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
