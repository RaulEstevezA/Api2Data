import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  // Production build (and `vite preview` of it) is served from the portfolio at raulesteveza.github.io/tools/Api2Data/
  base: command === 'build' || isPreview ? '/tools/Api2Data/' : '/',
  build: {
    rolldownOptions: {
      output: {
        // Libraries in their own files: they change less often than Api2Data, so browsers keep them cached
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            {
              name: 'codemirror',
              test: /node_modules[\\/](@codemirror|@lezer|style-mod|w3c-keyname|crelt)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    // Core tests run in Node; interface tests opt into jsdom with a comment at the top of the file
    environment: 'node',
  },
}))
