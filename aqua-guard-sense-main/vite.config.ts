import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8081,
    hmr: {
      // Optimize HMR for better development experience
      overlay: false, // Disable the overlay for error reporting
      // Increase HMR timeout to prevent too many refreshes
      timeout: 10000
    }
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Optimize build settings
  build: {
    // Improve performance by disabling source maps in production
    sourcemap: false,
    // Configure rollup options
    rollupOptions: {
      output: {
        // Chunk by module type for better caching
        manualChunks: {
          vendor: [
            'react', 
            'react-dom', 
            'react-router-dom'
          ],
          ui: [
            '@/components/ui'
          ]
        }
      }
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000
  }
});
