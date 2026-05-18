import type { AstroIntegration } from 'astro';
import { getFurnitureItems, copyFurnitureMedia } from './furniture-data.js';

/**
 * Astro integration that syncs furniture repos and copies media files into
 * public/moebel/<slug>/ before both dev-server start and production build.
 */
export function furnitureIntegration(): AstroIntegration {
  return {
    name: 'heimeliq-furniture',
    hooks: {
      'astro:config:setup': async ({ command, logger }) => {
        if (command === 'preview') return;
        logger.info('Synchronisiere Möbel-Repos…');
        const items = await getFurnitureItems();
        copyFurnitureMedia(items);
        const published = items.filter(i => i.published).length;
        logger.info(`✓ ${published} publizierte Möbel bereit`);
      },
    },
  };
}
