import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useConfigStore } from './stores/config'

// تحميل إعدادات الأعمال العامة (وسائل الدفع المفعلة، بيانات التواصل)
// مرة واحدة عند الإقلاع — عليها تُبنى خيارات الدفع والتذييل بصدق
useConfigStore.getState().loadConfig()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
