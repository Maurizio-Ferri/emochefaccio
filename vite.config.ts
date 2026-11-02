import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// base relativa: funziona sia su maurizio-ferri.github.io/emochefaccio sia su un dominio proprio
export default defineConfig({
  base: "./",
  plugins: [tailwindcss()],
});
