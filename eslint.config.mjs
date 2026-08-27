import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

// eslint-config-next 16 ships native flat configs, so we spread them directly (no FlatCompat).
// `prettier` comes last to switch off any stylistic rules — formatting is owned by `npm run format`.
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "dist/**",
      "build/**",
      "ds-bundle/**",
      ".design-sync/**",
      ".ds-sync/**",
      "playwright-report/**",
      "test-results/**",
      "blob-report/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  prettier,
  {
    // @react-pdf/renderer's <Image> is a PDF primitive with no `alt` concept — the
    // jsx-a11y/alt-text rule (meant for HTML/Next images) is a false positive here.
    files: ["src/components/pdf/**/*.tsx"],
    rules: { "jsx-a11y/alt-text": "off" },
  },
];

export default eslintConfig;
