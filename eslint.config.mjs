import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // AA-03 — Architecture Validation Gate (ver ARCHITECTURE.md): las
    // dependencias solo apuntan hacia dentro, app/infrastructure -> application
    // -> domain. Antes esta regla se sostenía solo por disciplina; acá se
    // mecaniza con import/no-restricted-paths.
    files: [
      "src/domain/**/*.{ts,tsx}",
      "src/application/**/*.{ts,tsx}",
      "src/infrastructure/**/*.{ts,tsx}",
    ],
    plugins: { import: importPlugin },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/domain",
              from: ["./src/application", "./src/infrastructure", "./src/app"],
              message: "domain/ no puede depender de application/, infrastructure/ ni app/ (AA-03).",
            },
            {
              target: "./src/application",
              from: ["./src/infrastructure", "./src/app"],
              message: "application/ no puede depender de infrastructure/ ni app/ (AA-03).",
            },
            {
              target: "./src/infrastructure",
              from: ["./src/app"],
              message: "infrastructure/ no puede depender de app/ (AA-03).",
            },
          ],
        },
      ],
    },
  },
  {
    // domain/ debe ser TypeScript puro (ARCHITECTURE.md): cero dependencias
    // externas, ni siquiera Next/React/Supabase.
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*", "react", "react-dom", "@supabase/*"],
              message: "domain/ debe ser TypeScript puro (AA-03): no puede depender de Next, React ni Supabase.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
