import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      "no-console": "error",
      // Regras novas do eslint-plugin-react-hooks (Next 16), pensadas para o
      // React Compiler, que o projeto não usa. Os pontos que elas apontam no
      // código atual não são bugs; ficam como aviso até uma limpeza dedicada
      // (registrada em docs/ROADMAP_2.md, Fase 12).
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
  globalIgnores([".next/**", ".netlify/**", "node_modules/**", "playwright-report/**", "test-results/**", "next-env.d.ts"]),
]);
