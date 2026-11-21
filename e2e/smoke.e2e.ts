import { expect, test } from '@playwright/test';

test('smoke: the shell loads, navigation works and the theme is kept', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Generate' })).toBeVisible();

	await page.getByRole('navigation', { name: 'Main' }).first().getByText('Settings').click();
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
	await page.getByLabel('Parchment').check();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'parchment');

	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'parchment');
});

test('smoke: the storage notice shows until Got it and stays away after a reload', async ({
	page
}) => {
	await page.goto('/');
	const notice = page.getByRole('complementary', { name: 'Your library stays on this device' });
	await expect(notice).toBeVisible();
	await expect(notice).toContainText('Export backup');
	await page.getByRole('navigation', { name: 'Main' }).first().getByText('Library').click();
	await expect(notice).toBeVisible();
	await notice.getByRole('button', { name: 'Got it' }).click();
	await expect(notice).toHaveCount(0);
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
	await expect(notice).toHaveCount(0);
});
