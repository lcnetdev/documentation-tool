import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Read BASE_PATH from root .env for the dev proxy
let envBasePath = '/'
try {
  const __dirname = fileURLToPath(new URL('.', import.meta.url))
  const envContent = readFileSync(resolve(__dirname, '../.env'), 'utf-8')
  const match = envContent.match(/^BASE_PATH=(.*)$/m)
  if (match) envBasePath = match[1].trim()
} catch { /* no .env file, use default */ }

const basePath = process.env.VITE_BASE_PATH || envBasePath
const normalizedBase = basePath.startsWith('/') ? basePath : '/' + basePath

export default defineConfig({
  base: normalizedBase,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      [normalizedBase + 'api']: {
        target: 'http://localhost:4580',
        changeOrigin: true
      }
    }
  }
})
