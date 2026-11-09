import { createApp } from 'vue'
import App from './App.vue'
import { isTauri } from './utils/platform.js'
import './styles/app.css'
import './styles/document.css'

createApp(App).mount('#app')

// Installable, offline web app (src/sw.js). The desktop app ships its files, so it skips this.
if (import.meta.env.PROD && !isTauri && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
