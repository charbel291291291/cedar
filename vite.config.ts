import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import compression from 'vite-plugin-compression';

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "assets/hub_gaming.png", "assets/hub_smm.png", "assets/hub_wallet.png", "assets/whish-logo.png", "assets/cedar1.png"],
      manifest: {
        name: "Cedar Boost",
        short_name: "CedarBoost",
        description: "Premium digital recharge — SMM, games, wallet top-ups.",
        theme_color: "#D61414",
        background_color: "#050505",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "en",
        categories: ["finance", "utilities"],
        shortcuts: [
          {
            name: "My Orders",
            short_name: "Orders",
            description: "Track your active orders",
            url: "/orders",
            icons: [{ src: "/assets/cedar1.png", sizes: "768x768", type: "image/png" }]
          },
          {
            name: "Wallet",
            short_name: "Wallet",
            description: "Check balance & top up",
            url: "/dashboard",
            icons: [{ src: "/assets/cedar1.png", sizes: "768x768", type: "image/png" }]
          },
          {
            name: "SMM Engine",
            short_name: "SMM",
            description: "Social media growth services",
            url: "/smm-engine",
            icons: [{ src: "/assets/cedar1.png", sizes: "768x768", type: "image/png" }]
          }
        ],
        icons: [
          // 192x192 — required for Android home screen
          {
            src: "/assets/cedar1.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          // 512x512 — required for Play Store and larger displays
          {
            src: "/assets/cedar1.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          // 512x512 maskable — safe zone for Android adaptive icons
          {
            src: "/assets/cedar1.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,json}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-data",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 48 // 48 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "static-images",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ],
        navigateFallback: "/",
        navigateFallbackDenylist: [/^\/api\//],
      }
    })
  ],
  build: {
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router-dom|@supabase[\\/]supabase-js)[\\/]/.test(id)) {
            return 'vendor';
          }
          if (/[\\/]node_modules[\\/](lucide-react|recharts|sonner)[\\/]/.test(id)) {
            return 'ui';
          }
          return undefined;
        }
      }
    }
  },
  server: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
