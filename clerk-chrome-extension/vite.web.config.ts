import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  root: "web",
  plugins: [react()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src")
    }
  },
  css: {
    postcss: path.resolve(__dirname, "postcss.config.js")
  },
  build: {
    outDir: "../build/web",
    emptyOutDir: true
  }
})
