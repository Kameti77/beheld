import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";
import path from "path";

export default defineConfig({
  root: "src",
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  plugins: [
    react(),
    webExtension({
      manifest: () => readJsonFile("src/manifest.json"),
    }),
  ],
});