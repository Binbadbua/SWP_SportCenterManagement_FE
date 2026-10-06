import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Requests to /api are forwarded to the ASP.NET Core back-end during development,
// so the browser never needs CORS. Change the target in .env (VITE_API_PROXY_TARGET).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:5047',
          changeOrigin: true,
        },
      },
    },
  };
});
