/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { APP } from './src/app.config';

// base './' keeps the build portable: GitHub Pages subpath, a laptop, anywhere.
export default defineConfig({
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeManifestIcons: false,
      manifest: {
        name: APP.name,
        short_name: APP.shortName,
        description: APP.name,
        theme_color: '#120d24',
        background_color: '#120d24',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,webmanifest}'],
        manifestTransforms: [async (manifest) => ({
          manifest: await Promise.all(manifest.map(async (entry) => {
            const file = fileURLToPath(new URL(`./dist/${entry.url}`, import.meta.url));
            const digest = createHash('sha256').update(await readFile(file)).digest('base64');
            return { ...entry, integrity: `sha256-${digest}` };
          })),
        })],
      },
    }),
  ],
  build: { target: 'es2022', cssMinify: true },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'worker/src/**/*.test.ts'] },
});
