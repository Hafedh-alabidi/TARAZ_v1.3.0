import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

// ✅ خدمة تطبيق نقطة البيع (نسخة مبنية) تحت /pos/ من نفس خادم المعاينة
function posSpaPlugin(): Plugin {
  const posIndex = fileURLToPath(new URL('./public/pos/index.html', import.meta.url))
  return {
    name: 'pos-spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (url === '/pos' || url === '/pos/') {
          res.writeHead(302, { Location: '/pos/index.html' })
          res.end()
          return
        }
        // روابط POS الداخلية (بلا امتداد ملف) → فهرس تطبيق POS
        if (url.startsWith('/pos/') && !path.extname(url) && fs.existsSync(posIndex)) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(fs.readFileSync(posIndex))
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), posSpaPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    host: true,
    // السماح بالنطاقات الخارجية (رابط المعاينة عبر space-z.ai + بوابة fcapp الداخلية)
    allowedHosts: ['.space-z.ai', '.z.ai', 'localhost', '.fcapp.run', '.aliyun.com'],
    proxy: {
      // في التطوير: توجيه نداءات الـ API إلى خادم Django
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // ✅ صور المنتجات المرفوعة خادمياً (media)
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // ✅ لوحة تحكم Django (الإدارة الكاملة) عبر رابط المعاينة نفسه
      '/admin': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // ✅ ملفات Django الإدارية الثابتة (CSS/JS للوحة التحكم)
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
})
