import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_PORT = Number(process.env.CLOUD_AI_API_PORT || 3001)

/**
 * Host allowlist for the external preview hostname.
 *
 * The preview proxy forwards the request with
 * `Host: <port>-<sandbox id>.<BASE44_SANDBOX_HOST_DOMAIN>` and the sandbox id
 * changes whenever the environment is recreated, so only the sandbox domain
 * wildcard is added - never an exact host - and only when running inside the
 * Base44 preview (BASE44_PREVIEW_MODE === "1"). Outside preview mode the
 * original, restrictive default is kept.
 */
const previewHostAllowlist = (): string[] => {
  const sandboxDomain = process.env.BASE44_SANDBOX_HOST_DOMAIN
  const base = ['localhost', '127.0.0.1']
  if (process.env.BASE44_PREVIEW_MODE === '1' && sandboxDomain) {
    return ['.' + sandboxDomain, ...base]
  }
  // Vite also appends __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS to allowedHosts.
  return base
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: previewHostAllowlist(),
    // Single-origin wiring: the API is reached through this dev server, so the
    // app never needs CORS and cookies/session behave as same-origin.
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: false,
      },
    },
    // Bind mounts on the sandbox do not always emit inotify events.
    watch: { usePolling: true, interval: 800 },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
})
