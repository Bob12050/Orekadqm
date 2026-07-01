import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages はサブパス配信になるため、CI では BASE_PATH を渡してビルドする。
// アセットURLは実行時に import.meta.env.BASE_URL を前置すること。
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  plugins: [
    VitePWA({
      registerType: 'prompt', // 新バージョンは戦闘中に適用せずタイトル復帰時に適用する
      injectRegister: null,
      manifest: {
        name: 'Orekadqm',
        short_name: 'Orekadqm',
        description: 'モバイル縦画面専用アクションRPG',
        theme_color: '#1b1030',
        background_color: '#1b1030',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        // セーブデータは IndexedDB を使うため SW キャッシュには一切入れない。
        navigateFallbackDenylist: [/\.json$/],
      },
    }),
  ],
})
