import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    // Khai báo PostCSS inline để Vite KHÔNG dò ngược lên thư mục cha
    // (cms-preview/ có postcss.config.js chạy Tailwind — không thuộc project này).
    postcss: {},
  },
})
