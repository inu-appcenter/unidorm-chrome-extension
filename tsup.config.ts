import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { background: "src/background/index.ts" },
    format: ["esm"],
    outDir: "dist",
    clean: true,
    sourcemap: true,
    splitting: false,
    noExternal: [/.*/],
    outExtension: () => ({ js: ".js" }),
  },
  {
    entry: {
      content: "src/content/bridge.ts",
      popup: "src/popup/popup.ts",
    },
    format: ["iife"],
    outDir: "dist",
    clean: false,
    sourcemap: true,
    splitting: false,
    noExternal: [/.*/],
    outExtension: () => ({ js: ".js" }),
  },
]);
