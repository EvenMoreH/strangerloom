import { expect, test } from '@playwright/test';

test('settings: features can be switched off and the default view can be compact', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('tab', { name: 'Combat NPC' }).click();
	const card = page.getByRole('article');
	await expect(card.locator('[data-section="tracker"]')).toBeVisible();
	await expect(card.locator('[data-view="full"]')).toBeVisible();
	await expect(page.getByText('Keys:')).toBeVisible();

	await page.goto('/#/settings');
	await page.getByRole('checkbox', { name: /tracker/ }).uncheck();
	await page.getByRole('checkbox', { name: /Keyboard shortcuts/ }).uncheck();
	await page.getByRole('radio', { name: 'Compact' }).check();

	await page.goto('/');
	await page.getByRole('tab', { name: 'Combat NPC' }).click();
	await expect(card.locator('[data-view="compact"]')).toBeVisible();
	await expect(card.locator('[data-section="tracker"]')).toHaveCount(0);
	await expect(page.getByText('Keys:')).toHaveCount(0);
	// The switch on the card still changes the view of the current NPC.
	await page.getByRole('button', { name: 'Full' }).click();
	await expect(card.locator('[data-view="full"]')).toBeVisible();

	// Preferences survive a reload.
	await page.reload();
	await page.getByRole('tab', { name: 'Combat NPC' }).click();
	await expect(card.locator('[data-view="compact"]')).toBeVisible();
	await expect(card.locator('[data-section="tracker"]')).toHaveCount(0);
});
