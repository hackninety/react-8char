import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // tyme4ts 只出现在动态 import 的引擎 chunk 里，dev 冷启动扫描不到；
    // 显式预构建，避免首次对拍请求触发 re-optimization 导致加载悬挂
    include: ["tyme4ts"],
  },
})