import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Browser extension pages can reject Vite's modulepreload links as
    // cross-world extension resources. Chunks still load normally on demand.
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        options: resolve(__dirname, "options.html"),
        background: resolve(__dirname, "src/background/index.js")
      },
      output: {
        entryFileNames: chunk => {
          if (chunk.name === "background") return "background.js";
          return "[name].js";
        },
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    },
    sourcemap: false,
    cssCodeSplit: false
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env": JSON.stringify({}),
    process: JSON.stringify({ env: { NODE_ENV: "production" } })
  }
});
