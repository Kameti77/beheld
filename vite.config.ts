import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";

export default defineConfig({
  build: {
    emptyOutDir: true,
  },
  plugins: [
    react(),
    webExtension({
      manifest: () => readJsonFile("manifest.json"),
      additionalInputs: ["src/offscreen/offscreen.html"],
    }),
  ],
});