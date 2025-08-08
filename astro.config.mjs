// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'compile', // Use compile-time image optimization instead of runtime sharp
  }),
  site: 'https://www.trackyourlabs.com',
  integrations: [],
  vite: {
    plugins: [tailwindcss()],
  },
});