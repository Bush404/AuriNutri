import { Logo } from "@/components/shared/logo";
import { Leaf, LineChart, UtensilsCrossed } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Coluna do formulário */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10">
            <Logo />
          </div>
          {children}
        </div>
      </div>

      {/* Coluna de branding */}
      <div className="relative hidden overflow-hidden bg-primary-800 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-700/50 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative z-10">
          <p className="text-sm font-medium uppercase tracking-widest text-primary-200">
            Para nutricionistas modernos
          </p>
          <h1 className="mt-4 max-w-md text-3xl font-semibold leading-tight text-white">
            Simplifique sua rotina clínica em um só lugar.
          </h1>
        </div>

        <div className="relative z-10 space-y-5">
          <FeatureItem
            icon={UtensilsCrossed}
            title="Planos alimentares em minutos"
            description="Monte refeições e calcule macros automaticamente."
          />
          <FeatureItem
            icon={LineChart}
            title="Evolução do paciente"
            description="Acompanhe peso, IMC e circunferências ao longo do tempo."
          />
          <FeatureItem
            icon={Leaf}
            title="Seu próprio banco de alimentos"
            description="Cadastre os alimentos que você mais utiliza na prática."
          />
        </div>
      </div>
    </div>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl bg-white/5 p-4 backdrop-blur-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/90">
        <Icon className="h-5 w-5 text-primary-900" />
      </div>
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-sm text-primary-200">{description}</p>
      </div>
    </div>
  );
}
