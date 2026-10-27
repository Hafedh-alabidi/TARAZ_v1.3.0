import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // تموضع البناء تحت /pos/ لخدمته من رابط معاينة المتجر نفسه
  // VITE_BASE=/ عند النشر على نطاق مستقل (مثل Render Static Site)
  base: process.env.VITE_BASE || '/pos/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    // السماح بالنطاقات الخارجية (رابط المعاينة عبر space-z.ai + بوابة fcapp الداخلية)
    allowedHosts: ['.space-z.ai', '.z.ai', 'localhost', '.fcapp.run', '.aliyun.com'],
    proxy: {
      // في التطوير: توجيه نداءات الـ API إلى خادم Django
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
})
