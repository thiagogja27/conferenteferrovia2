import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // The app runs Vite in middleware mode behind Express. Vite cannot
      // attach its HMR WebSocket to that custom listener, so do not inject
      // the HMR client (which otherwise repeatedly reports a closed socket).
      hmr: false,
      watch: null,
    },
  };
});
