import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, allowedHosts: ['vmi3309897.tail833c52.ts.net', 'cbc.the13.eu'] },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['./src/test-setup.ts'], passWithNoTests: true },
})
