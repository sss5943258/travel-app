import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/travel-app', // 請確保這與你在 Github 的 Repository 名稱一致
  plugins: [
    react(),
    VitePWA({ 
      registerType: 'autoUpdate',
      includeAssets: ['bg.png', 'vite.svg'],
      manifest: {
        name: '日本旅遊行程',
        short_name: 'TravelAPP',
        description: '大阪五日遊行程',
        theme_color: '#FFB7C5',
        icons: [
          {
            src: 'vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
})
