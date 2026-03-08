import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "mystilight-8char-v2": path.resolve(__dirname, "../mystilight-8char-v2/src/v2/index.mjs"),
    },
  },
})
