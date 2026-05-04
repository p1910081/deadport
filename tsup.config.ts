import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm', 'cjs'],
  outDir: 'dist',
  target: 'node18',
  banner: { js: '#!/usr/bin/env node' },
  splitting: false,
  clean: true,
  minify: process.env['NODE_ENV'] === 'production',
  sourcemap: true,
  dts: false,
});
