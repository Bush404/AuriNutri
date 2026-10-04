import { cn } from "@/lib/utils";

/**
 * Raminho do rodapé do menu lateral, redesenhado a partir do layout de referência
 * (mesmas coordenadas: o menu tem 240px como lá). viewBox em pixels do print.
 * Cores próprias da ilustração (verde-sálvia suave), não reaproveitadas na interface.
 */
export function LeafSprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 824 120 136" aria-hidden className={cn("pointer-events-none select-none", className)}>
      <defs>
        <linearGradient id="leaf-sprig-forte" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#8cc072" />
          <stop offset="1" stopColor="#b6db9c" />
        </linearGradient>
        <linearGradient id="leaf-sprig-clara" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#d3e8c7" />
          <stop offset="1" stopColor="#e7f2df" />
        </linearGradient>
      </defs>
      <path d="M-4 934 C -16.7 921.1 -11.7 898.9 9 884 C 16.6 904.1 12.4 926.5 -4 934 Z" fill="#e6f1e1" opacity={0.7} />
      <path d="M0 948 C 16 930, 29 905, 35 871" fill="none" stroke="#d2e6c7" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M23 915 C 31 907, 39 902, 47 899" fill="none" stroke="#d9eacf" strokeWidth={1.2} strokeLinecap="round" />
      <path d="M47 899 C 46.8 885.3 62.8 871.2 84 868 C 76.9 885.1 61.3 899.5 47 899 Z" fill="url(#leaf-sprig-clara)" />
      <path d="M49.2 897.1 Q 64.7 882.5 80.0 870.7" fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={0.8} />
      <path d="M35 871 C 30.4 860.1 38.8 844.9 55 837 C 54.7 852.4 46.7 867.8 35 871 Z" fill="url(#leaf-sprig-forte)" opacity={0.8} />
      <path d="M36.2 869.0 Q 44.0 853.4 52.7 840.2" fill="none" stroke="#ffffff" strokeOpacity={0.5} strokeWidth={0.8} />
    </svg>
  );
}

/**
 * Duas folhas grandes e bem apagadas atrás do cabeçalho do painel (canto superior
 * direito), no mesmo formato de amêndoa do rodapé do menu, como no layout de referência.
 */
export function CornerLeaves({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 340 150" aria-hidden className={cn("pointer-events-none select-none", className)}>
      <path d="M10 150 C -4.4 70.8 72.5 -10.7 190 -30 C 166.2 68.6 91.7 152.5 10 150 Z" className="fill-brand-green" fillOpacity={0.1} />
      <path d="M170 150 C 161.4 84.2 229.9 7.6 330 -20 C 305.5 66.0 238.9 144.3 170 150 Z" className="fill-brand-green" fillOpacity={0.07} />
    </svg>
  );
}

/**
 * Raminho apagado atrás do cabeçalho do perfil do paciente, traçado sobre o layout de
 * referência (viewBox nas coordenadas do print: o ramo fica entre o nome e os botões).
 */
export function ProfileLeaves({ className }: { className?: string }) {
  return (
    <svg viewBox="900 62 190 200" aria-hidden className={cn("pointer-events-none select-none", className)}>
      <path d="M960 250 C 930 225, 908 192, 904 158 C 934 176, 957 211, 960 250 Z" fill="#cfe5c4" opacity={0.35} />
      <path d="M955 258 C 980 210, 1020 150, 1087 68" fill="none" stroke="#cfe5c4" strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
      <path d="M972 228 C 950 195, 944 140, 958 108 C 979 140, 986 195, 972 228 Z" fill="#c9e2bc" opacity={0.55} />
      <path d="M1003 175 C 1000 130, 1040 86, 1087 68 C 1080 115, 1046 160, 1003 175 Z" fill="#b9d9a8" opacity={0.6} />
      <path d="M982 232 C 1010 196, 1046 178, 1083 173 C 1065 206, 1026 230, 982 232 Z" fill="#c4dfb5" opacity={0.55} />
    </svg>
  );
}

/**
 * Montanha com bandeirinha no canto do bloco "Objetivo do paciente", traçada sobre o
 * layout de referência (viewBox nas coordenadas do print).
 */
export function GoalMountain({ className }: { className?: string }) {
  return (
    <svg
      viewBox="1280 655 345 130"
      preserveAspectRatio="xMaxYMax meet"
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
    >
      <path
        d="M1280 783 C 1320 768, 1350 760, 1372 760 C 1395 760, 1410 768, 1420 760 C 1440 745, 1450 735, 1460 736 C 1470 737, 1475 744, 1485 740 C 1500 732, 1515 718, 1530 703 C 1538 695, 1542 690, 1547 689 C 1553 690, 1560 700, 1572 718 C 1585 735, 1605 752, 1625 765 L 1625 783 Z"
        className="fill-primary"
        fillOpacity={0.09}
      />
      <path d="M1500 783 C 1515 750, 1530 715, 1547 689 C 1565 720, 1590 760, 1612 783 Z" className="fill-primary" fillOpacity={0.07} />
      <path d="M1545 690 L 1545 663" className="stroke-primary" strokeOpacity={0.18} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M1546 663 L 1568 671 L 1546 679 Z" className="fill-primary" fillOpacity={0.16} />
    </svg>
  );
}
