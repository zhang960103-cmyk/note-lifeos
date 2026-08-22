// 从 "vitest/config" 导入 defineConfig（而不是 "vite"）：它是 vite 原版 defineConfig
// 的超集，额外认识下面的 test 字段，vite build/dev 行为不受影响，但能让 `test:` 块
// 通过类型检查——之前仓库里 `npm test` 能跑，只是因为没人在 vite.config.ts 里配置过
// 测试环境变量，纯逻辑单测（不依赖 import.meta.env）才凑巧能过。
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    // 单测里不会真的连 Supabase，这里只是给 validateEnvironment() 一组占位值，
    // 让依赖 import.meta.env.VITE_SUPABASE_URL 的代码路径能被正常执行到。
    env: {
      VITE_SUPABASE_URL: "https://test-project.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
    },
  },
}));
