import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: '/spp-bendahara/',
  plugins: [viteSingleFile()],
  build: {
    assetsInlineLimit: 100000000,
  }
});
