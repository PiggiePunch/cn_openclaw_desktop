import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  optimizeDeps: {
    exclude: ['@tauri-apps/api'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 将 React 核心库分离
          vendor: ['react', 'react-dom'],
          // 将 Radix UI 组件分离
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
          ],
          // 将工具库分离
          utils: ['clsx', 'tailwind-merge', 'class-variance-authority'],
          // 将 Markdown 渲染库分离
          markdown: ['react-markdown', 'rehype-highlight', 'remark-gfm'],
        },
      },
    },
    // 提高 chunk 大小警告阈值到 1000 KB
    chunkSizeWarningLimit: 1000,
  },
}))
