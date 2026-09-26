import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

/**
 * Keeps ONNX Runtime out of Vite's dependency prebundle so its WebAssembly
 * binaries resolve beside the runtime module in development and production.
 */
export default defineConfig({
  plugins: [tailwindcss()],
  optimizeDeps: {
    exclude: ['@bunnio/rembg-web', 'onnxruntime-web'],
  },
});
