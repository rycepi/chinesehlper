import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    copyPublicDir: false,
    lib: {
      entry: resolve(__dirname, "src/content/spotifyEntry.js"),
      name: "spotifyLyrics",
      formats: ["iife"],
      fileName: () => "spotify.js"
    },
    sourcemap: false
  }
});
