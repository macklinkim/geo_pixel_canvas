import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [svelte(), cloudflare()],
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  build: {
    target: "es2022",
  },
});
