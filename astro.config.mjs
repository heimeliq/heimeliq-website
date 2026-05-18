import { defineConfig } from 'astro/config';
import { furnitureIntegration } from './src/lib/furniture-integration.js';

export default defineConfig({
  output: 'static',
  integrations: [furnitureIntegration()],
});
