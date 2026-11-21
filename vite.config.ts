import { readFileSync } from 'node:fs';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig, loadEnv } from 'vite';

const { version } = JSON.parse(
	readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version: string };

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), 'VITE_');
	const base = env.VITE_BASE_PATH || '/';
	return {
		base,
		define: { __APP_VERSION__: JSON.stringify(version) },
		plugins: [
			svelte(),
			tailwindcss(),
			VitePWA({
				registerType: 'autoUpdate',
				includeAssets: ['favicon.svg', 'favicon.ico', 'favicon-*.png', 'apple-touch-icon.png'],
				manifest: {
					name: 'Strangerloom',
					short_name: 'Strangerloom',
					description: 'NPC and party generator for tabletop role-playing games.',
					id: base,
					lang: 'en',
					categories: ['games', 'utilities'],
					theme_color: '#1c1917',
					background_color: '#1c1917',
					display: 'standalone',
					start_url: base,
					scope: base,
					icons: [
						{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
						{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
						{
							src: 'maskable-512x512.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'maskable'
						}
					]
				},
				workbox: {
					globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
					navigateFallback: `${base}index.html`
				}
			})
		],
		test: {
			include: ['src/**/*.test.ts'],
			environment: 'node'
		}
	};
});
