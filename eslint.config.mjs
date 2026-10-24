// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import eslint from "@eslint/js";
import tsEslint from "typescript-eslint";
import globals from "globals";

export default tsEslint.config({
    ignores: ["/node_modules", "main.js", "docs/**", ".system-bundle-cache/**", "scripts/tmp-ts-loader.js"],
}, eslint.configs.recommended, tsEslint.configs.eslintRecommended, tsEslint.configs.recommended, {
    plugins: {
        "@typescript-eslint": tsEslint.plugin,
    },
    languageOptions: {
        globals: {
            ...globals.node,
        },
        parser: tsEslint.parser,
        sourceType: "module",
    },
    rules: {
        "no-prototype-builtins": "off",
        "no-unused-vars": "off",

        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
        "@typescript-eslint/no-unused-expressions": ["error", { allowShortCircuit: true, allowTernary: true }],
    },
}, {
    // Lazy / CommonJS requires are intentional here: the loaders, scripts and
    // tests run outside the esbuild bundle or defer imports to break cycles.
    files: [
        "scripts/**",
        "test/**",
        "lib/systems/ts-loader.ts",
        "lib/plugin/rule-call-processor.tsx",
        "lib/plugin/process-rpg-fences.ts",
        "lib/views/CompilationBasesView.ts",
        "vault/**",
    ],
    rules: {
        "@typescript-eslint/no-require-imports": "off",
    },
}, {
    // `export const X = {...}` merged with `export namespace X { type ... }`
    // exposes sub-component prop types as X.FooProps.
    files: ["lib/ui/**"],
    rules: {
        "@typescript-eslint/no-namespace": "off",
    },
}, storybook.configs["flat/recommended"]);
