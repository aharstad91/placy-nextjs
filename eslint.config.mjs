import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // === Strict rules (error) ===
      "prefer-const": "error",
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
      "@next/next/no-img-element": "warn",
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
  // Allow {} in Supabase generated type definitions
  {
    files: ["lib/supabase/types.ts", "lib/supabase/database.types.ts"],
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
