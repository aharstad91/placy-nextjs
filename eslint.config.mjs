import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // === Strict rules (error) ===
      "prefer-const": "error",
      // ALDRI <img> — bruk next/image (CLAUDE.md-arkitekturregel; 0 brudd
      // ved skjerping 2026-07-06, audit-bead 03t)
      "@next/next/no-img-element": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@supabase/supabase-js",
              message:
                "Import from @/lib/supabase instead of @supabase/supabase-js directly.",
            },
          ],
        },
      ],

      // === Advisory rules (warn) ===
      "no-console": ["warn", { allow: ["error", "warn"] }],
      "@next/next/no-html-link-for-pages": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-explicit-any": "warn",

      // === Disabled rules ===
      // React Compiler rules require React 19/Next.js 15+ — not applicable
      "react-compiler/react-compiler": "off",
      "react-hooks/static-components": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
    },
  },
  // ALDRI runtime-LLM i app/ (CLAUDE.md: build-time only) — SDK-importer
  // gir error i app-runtime; build-time (scripts/, lib/gemini/) er unntatt
  // under. Audit-bead 03t: runtime-LLM-ruten overlevde fordi regelen ikke
  // var maskinell.
  {
    files: ["app/**/*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@supabase/supabase-js",
              message:
                "Import from @/lib/supabase instead of @supabase/supabase-js directly.",
            },
            {
              name: "@anthropic-ai/sdk",
              message:
                "ALDRI runtime-LLM i app/ — build-time only (scripts/ + lib/gemini/). CLAUDE.md LLM-regel.",
            },
            {
              name: "@google/generative-ai",
              message:
                "ALDRI runtime-LLM i app/ — build-time only (scripts/ + lib/gemini/). CLAUDE.md LLM-regel.",
            },
          ],
        },
      ],
    },
  },
  // Allow {} in Supabase generated type definitions
  {
    files: ["lib/supabase/types.ts"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  // Allow lib/supabase wrappers to import from @supabase/supabase-js
  {
    files: ["lib/supabase/**/*"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Allow scripts to use console and direct supabase imports
  {
    files: ["scripts/**/*"],
    rules: {
      "no-console": "off",
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
