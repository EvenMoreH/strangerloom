import { expect, test, type Page } from '@playwright/test';

// Without the service worker, so a blocked script really stays away (requests the worker answers skip routes).
test.use({ serviceWorkers: 'block' });

const THEMES: [label: string, id: string, scheme: 'light' | 'dark'][] = [
	['Light', 'light', 'light'],
	['Paper', 'paper', 'light'],
	['Parchment', 'parchment', 'light'],
	['Sepia', 'sepia', 'light'],
	['Frost', 'frost', 'light'],
	['Lilac', 'lilac', 'light'],
	['High contrast', 'contrast', 'light'],
	['Dark', 'dark', 'dark'],
	['Graphite', 'graphite', 'dark'],
	['Midnight', 'midnight', 'dark'],
	['Candlelight', 'candlelight', 'dark'],
	['Horror', 'horror', 'dark'],
	['Cyberpunk', 'cyberpunk', 'dark'],
	['Terminal', 'terminal', 'dark']
];

// Colours as the browser computes them, since the built stylesheet may shorten them (#ffffff to #fff).
const rootState = (page: Page) =>
	page.evaluate(() => {
		const probe = document.createElement('span');
		document.body.append(probe);
		const rgb = (colour: string) => {
			probe.style.color = colour;
			return getComputedStyle(probe).color;
		};
		const style = getComputedStyle(document.documentElement);
		const state = {
			surface: rgb(style.getPropertyValue('--surface').trim()),
			scheme: style.colorScheme,
			metas: [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) =>
				rgb(m.content)
			)
		};
		probe.remove();
		return state;
	});

test('themes: the picker lists Match system, the light themes and the dark themes, and each one applies', async ({
	page
}) => {
	await page.goto('/#/settings');
	const picker = page.getByRole('group', { name: 'Theme' });
	const labels = await picker
		.getByRole('radio')
		.evaluateAll((els) => els.map((el) => el.closest('label')?.textContent?.trim()));
	expect(labels).toEqual(['Match system', ...THEMES.map(([label]) => label)]);
	await expect(picker.getByRole('group', { name: 'Light' }).getByRole('radio')).toHaveCount(7);
	await expect(picker.getByRole('group', { name: 'Dark' }).getByRole('radio')).toHaveCount(7);

	const html = page.locator('html');
	for (const [label, id, scheme] of THEMES) {
		await picker.getByRole('radio', { name: label, exact: true }).check();
		await expect(html).toHaveAttribute('data-theme', id);
		const state = await rootState(page);
		expect(state.scheme, id).toBe(scheme);
		expect(state.metas, id).toEqual([state.surface, state.surface]);
	}

	await picker.getByRole('radio', { name: 'Match system' }).check();
	await expect(html).not.toHaveAttribute('data-theme');
	expect((await rootState(page)).metas).toEqual(['rgb(250, 250, 249)', 'rgb(28, 25, 23)']);
});

test('themes: headings take the theme font, solid buttons the fill and glow, the page its image', async ({
	page
}) => {
	await page.goto('/#/settings');
	const pick = (label: string) => page.getByRole('radio', { name: label, exact: true }).check();
	const heading = page.getByRole('heading', { name: 'Settings' });

	await pick('Candlelight');
	await expect(heading).toHaveCSS('font-family', /^Cinzel/);
	expect(
		await page.evaluate(async () => {
			await document.fonts.load('600 20px Cinzel');
			return document.fonts.check('600 20px Cinzel');
		})
	).toBe(true);
	await expect(page.locator('body')).not.toHaveCSS('background-image', 'none');

	await pick('Light');
	await expect(heading).toHaveCSS('font-family', /^"Inter Variable"/);
	await expect(page.locator('body')).toHaveCSS('background-image', 'none');

	await page.goto('/#/tools');
	const roll = page.getByRole('button', { name: 'Roll', exact: true });
	await expect(roll).toHaveCSS('box-shadow', 'none');

	await page.goto('/#/settings');
	await pick('Horror');
	await page.goto('/#/tools');
	// Oxblood buttons with cream text; the lighter red stays for accent text and outlines.
	await expect(roll).toHaveCSS('background-color', 'rgb(179, 58, 47)');
	await expect(roll).toHaveCSS('color', 'rgb(251, 246, 238)');

	await page.goto('/#/settings');
	await pick('Terminal');
	await page.goto('/#/tools');
	await expect(roll).toHaveCSS('box-shadow', /rgba\(61, 255, 160, 0\.35\)/);
	await expect(page.getByRole('heading', { name: 'Dice roller' })).toHaveCSS(
		'font-family',
		/^Orbitron/
	);
});

test('themes: a stored theme is applied before the app script runs, and unknown values are ignored', async ({
	page
}) => {
	await page.goto('/');
	await page.evaluate(() =>
		localStorage.setItem('strangerloom.prefs', JSON.stringify({ theme: 'cyberpunk' }))
	);
	await page.route(/\/(src\/main\.ts|assets\/index-[\w-]+\.js)$/, (route) => route.abort());
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'cyberpunk');
	// The app itself did not start.
	await expect(page.locator('#app')).toBeEmpty();

	await page.evaluate(() =>
		localStorage.setItem('strangerloom.prefs', JSON.stringify({ theme: 'Neon' }))
	);
	await page.unrouteAll();
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Generate' })).toBeAttached();
	await expect(page.locator('html')).not.toHaveAttribute('data-theme');
});
