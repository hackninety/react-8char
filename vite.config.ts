import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { mystilightEsbuildPlugin, mystilightVitePlugin } from "./scripts/mystilight-jieqi-patch.mjs"

export default defineConfig({
  // mystilight 节气尺度补丁：build 走 transform；dev 下该 CJS 包经 esbuild 预构建，需在 optimizeDeps 里同样打补丁
  plugins: [mystilightVitePlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // tyme4ts 只出现在动态 import 的引擎 chunk 里，dev 冷启动扫描不到；
    // 显式预构建，避免首次对拍请求触发 re-optimization 导致加载悬挂
    include: ["tyme4ts"],
    esbuildOptions: { plugins: [mystilightEsbuildPlugin()] },
  },
})
