import fs from "fs"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const localV2 = path.resolve(__dirname, "../mystilight-8char-v2/src/v2/index.mjs")
const useLocalV2 = fs.existsSync(localV2)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      ...(useLocalV2 ? { "mystilight-8char-v2": localV2 } : {}),
    },
  },
})
