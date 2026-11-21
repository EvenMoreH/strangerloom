import { expect, test } from '@playwright/test';

test('offline: once the service worker has installed, the app loads and generates without the network', async ({
	page,
	context
}) => {
	await page.goto('/');
	await expect(page.getByRole('article')).toBeVisible();
	// Wait for the service worker to control the page and finish precaching.
	await page.evaluate(async () => {
		const reg = await navigator.serviceWorker.ready;
		await reg.update();
		if (!navigator.serviceWorker.controller) {
			await new Promise((resolve) =>
				navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
			);
		}
	});
	await page.waitForTimeout(500);

	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Generate' })).toBeVisible();
	const card = page.getByRole('article');
	await expect(card).toBeVisible();
	const first = await card.getByRole('heading', { level: 2 }).textContent();
	await page.getByRole('button', { name: 'Generate' }).click();
	await expect(card.getByRole('heading', { level: 2 })).not.toHaveText(first!);

	// Every screen is precached, with its name data and adapters.
	await page.getByRole('tab', { name: 'Combat NPC' }).click();
	await page.getByRole('combobox', { name: 'System' }).selectOption('d20');
	await expect(card.locator('[data-view]')).toBeVisible();
	for (const screen of ['Library', 'Tools', 'Editor', 'Settings']) {
		await page.getByRole('navigation', { name: 'Main' }).first().getByText(screen).click();
		await expect(page.getByRole('heading', { name: screen })).toBeVisible();
	}

	// The heading fonts of the themes are precached too.
	for (const [theme, font] of [
		['Candlelight', '600 20px Cinzel'],
		['Horror', "600 20px 'Special Elite'"],
		['Terminal', '600 20px Orbitron']
	]) {
		await page.getByRole('radio', { name: theme, exact: true }).check();
		const loaded = await page.evaluate(async (f) => {
			const faces = await document.fonts.load(f).catch(() => []);
			return faces.length > 0 && faces.every((face) => face.status === 'loaded');
		}, font);
		expect(loaded, theme).toBe(true);
	}
	await context.setOffline(false);
});
