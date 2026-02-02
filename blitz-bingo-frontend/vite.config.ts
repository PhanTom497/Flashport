import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  const nodeUrl = env.VITE_LINERA_TARGET_URL || 'https://testnet-conway.linera.net'

  return {
    plugins: [
      tailwindcss(),
      react()
    ],

    server: {
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
      proxy: {
        '/faucet-proxy': {
          target: 'https://faucet.testnet-conway.linera.net',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/faucet-proxy/, ''),
          secure: false,
        },
        '/node-proxy': {
          target: nodeUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/node-proxy/, ''),
          secure: false,
        }
      }
    },

    optimizeDeps: {
      exclude: ['@linera/client', '@linera/signer'],
    },

    worker: {
      format: 'es',
    },
  }
})
