import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: 'docs',
    // docs/ also holds DEVELOPMENT.md (GitHub Pages serves this dir);
    // the build script clears only docs/assets to avoid deleting it
    emptyOutDir: false
  }
})
