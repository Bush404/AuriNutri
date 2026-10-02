import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Botões à direita (ação principal da página). */
  actions?: React.ReactNode;
  className?: string;
}

/** Cabeçalho padrão de página: título (h1), descrição e ação principal. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col justify-between gap-4 sm:flex-row sm:items-end", className)}>
      <div className="min-w-0">
        <h1 className="text-h1 text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Rótulo de seção ("VISÃO GERAL") com ação opcional à direita. */
export function SectionHeading({
  children,
  action,
  id,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 id={id} className="text-overline uppercase text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}
