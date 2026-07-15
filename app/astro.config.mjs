// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import alpinejs from '@astrojs/alpinejs';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [alpinejs({ entrypoint: '/src/lib/client/alpine/app.factory' })],
  adapter: cloudflare(),
  server: {
    port: 4321,
    host: true,
  },
  devToolbar: {
    enabled: false,
  },
});