import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Vendored component libraries we don't hand-maintain. Both are pulled in
    // from upstream registries and re-linting them just reports upstream's
    // style back at us — `react-hooks/refs` and `set-state-in-effect` alone
    // account for most of it, and "fixing" them means diverging from upstream
    // and eating the conflicts on every update.
    //
    // ai-elements additionally has pre-existing Base UI type drift already
    // carved out via typescript.ignoreBuildErrors in next.config.ts; this is
    // the lint half of that same carve-out. See CLAUDE.md.
    "components/ai-elements/**",
    "components/charts/**",

    // Registry components, added/updated via `npx shadcn add` rather than
    // hand-written. Two carry upstream patterns the compiler rules dislike
    // (carousel publishes its api to the parent from an effect; the sidebar
    // skeleton picks a random width), and editing them here would be undone by
    // the next registry update.
    "components/ui/carousel.tsx",
    "components/ui/sidebar.tsx",
  ]),
]);

export default eslintConfig;
