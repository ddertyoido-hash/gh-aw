import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Sandbox-only overrides.
 *
 * The Base44 sandbox serves this dev server through a public https proxy on
 * host port 3000, so the page origin is https and the sandbox hostname is not
 * known ahead of time. Everything below is gated on BASE44_PREVIEW_MODE === '1'
 * so ordinary local development keeps Vite's default behaviour.
 */
const previewMode = process.env.BASE44_PREVIEW_MODE === '1'
const sandboxHostDomain = process.env.BASE44_SANDBOX_HOST_DOMAIN

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // The sandbox id rotates, so only a wildcard is safe here.
    allowedHosts:
      previewMode && sandboxHostDomain ? [`.${sandboxHostDomain}`] : undefined,
    // HMR travels back through the https proxy on its default port.
    hmr: previewMode ? { protocol: 'wss', clientPort: 443 } : undefined,
    // Bind mounts occasionally miss inotify events; polling keeps reload reliable.
    watch: previewMode ? { usePolling: true, interval: 400 } : undefined,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
})
