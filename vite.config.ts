import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {

  const env = loadEnv(mode || 'development', process.cwd(), '');
  let platformHost = '';

  try {
    const backendBaseUrl = env.VITE_API_BASE_URL || '';
    if (backendBaseUrl) {
      const parsed = new URL(backendBaseUrl);
      const hostname = parsed.hostname.toLowerCase();
      platformHost = hostname.startsWith('api.') ? hostname.slice(4) : hostname;
    }
  } catch {
    platformHost = '';
  }

  const allowedHosts = ['localhost', '127.0.0.1', '.localhost'];
  if (platformHost) {
    allowedHosts.push(platformHost, `.${platformHost}`);
  }
  
  return {
    server: {
      port: 3000,
      host: true,
      allowedHosts,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL,
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname),
      }
    },
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL),
      'import.meta.env.VITE_API_PATH': JSON.stringify(env.VITE_API_PATH),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_ELEVEN_LABS_API_KEY': JSON.stringify(env.ELEVEN_LABS_API_KEY),
      'import.meta.env.VITE_DEEPGRAM_API_KEY': JSON.stringify(env.DEEPGRAM_API_KEY),
    }
  };
});
