import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { NavList } from "@/components/layout/nav-list";
import { LeafSprig } from "@/components/shared/leaf-decoration";

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
      <div className="flex h-20 shrink-0 items-center px-6">
        <Link href="/dashboard" aria-label="AuriNutri — ir para o Dashboard" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo />
        </Link>
      </div>

      <NavList />

      {/* Rodapé nas mesmas medidas do layout de referência: folhas encostadas na borda
          esquerda e o texto a 34px dela. */}
      <div className="relative h-[200px] shrink-0">
        <LeafSprig className="absolute bottom-16 left-0 h-[136px] w-[120px]" />
        <p className="absolute bottom-[59px] left-[34px] text-[13px] font-medium leading-[19px] text-primary-700">
          Mais saúde
          <br />
          em cada escolha.
        </p>
      </div>
    </aside>
  );
}
