import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      screens: {
        // Computador com altura suficiente: o painel cabe inteiro na tela, sem rolar.
        // Em telas baixas (notebook pequeno) a página volta a rolar normalmente.
        desk: { raw: "(min-width: 1024px) and (min-height: 700px)" },
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          // Escala do verde AuriNutri: 700 = #07583F (a cor principal), 900 = #063F31.
          50: "#eef6f2",
          100: "#d5ebe0",
          200: "#abd6c2",
          300: "#78ba9c",
          400: "#3f9772",
          500: "#1a7a55",
          600: "#0b6848",
          700: "#07583f",
          800: "#064a36",
          900: "#063f31",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          soft: "hsl(var(--success-soft))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          soft: "hsl(var(--warning-soft))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          soft: "hsl(var(--info-soft))",
        },
        brand: {
          green: "hsl(var(--brand-green))",
          lime: "hsl(var(--brand-lime))",
          orange: "hsl(var(--accent))",
        },
        sidebar: "hsl(var(--sidebar))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // Hierarquia de texto: títulos de página, de seção e de bloco.
      fontSize: {
        h1: ["1.75rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em", fontWeight: "600" }],
        h2: ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.01em", fontWeight: "600" }],
        h3: ["1rem", { lineHeight: "1.5rem", fontWeight: "600" }],
        // Rótulo de seção ("VISÃO GERAL") e do menu lateral
        overline: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.08em", fontWeight: "600" }],
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      // Sombras quase imperceptíveis: o visual se apoia em borda, espaço e contraste.
      // sm/DEFAULT/md/lg também são redefinidas para todas as telas usarem a mesma família.
      boxShadow: {
        sm: "0 1px 2px 0 rgb(6 63 49 / 0.04)",
        DEFAULT: "0 1px 2px 0 rgb(6 63 49 / 0.05), 0 1px 3px 0 rgb(6 63 49 / 0.04)",
        md: "0 4px 12px -2px rgb(6 63 49 / 0.08), 0 2px 4px -2px rgb(6 63 49 / 0.04)",
        lg: "0 12px 32px -8px rgb(6 63 49 / 0.16), 0 4px 8px -4px rgb(6 63 49 / 0.06)",
        soft: "0 2px 12px 0 rgb(6 63 49 / 0.05)",
        card: "0 1px 2px 0 rgb(6 63 49 / 0.04)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
