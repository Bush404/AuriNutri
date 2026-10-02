import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo oficial do AuriNutri (símbolo "A + folha" e nome), recortada da arte oficial em
 * public/brand/. Para trocar por uma versão melhor (SVG ou PNG de maior qualidade), basta
 * substituir os arquivos aurinutri-simbolo.png e aurinutri-nome.png mantendo os nomes.
 * O slogan não entra aqui: dentro do sistema só símbolo + nome.
 */
export function Logo({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/brand/aurinutri-simbolo.png"
        alt={iconOnly ? "AuriNutri" : ""}
        width={160}
        height={137}
        priority
        className={cn("w-auto shrink-0", iconOnly ? "h-7" : "h-9")}
      />
      {!iconOnly && (
        <Image
          src="/brand/aurinutri-nome.png"
          alt="AuriNutri"
          width={537}
          height={96}
          priority
          className="h-[21px] w-auto"
        />
      )}
    </div>
  );
}
