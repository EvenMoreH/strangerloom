import { expect, test } from '@playwright/test';

test('tools: the dice roller rolls expressions, logs them and rejects nonsense', async ({
	page
}) => {
	await page.goto('/#/tools');
	const input = page.getByRole('textbox', { name: 'Dice expression' });
	await expect(input).toHaveValue('1d20');

	await input.fill('4d6kh3 + 2');
	await page.getByRole('button', { name: 'Roll', exact: true }).click();
	await expect(input).toHaveValue('4d6kh3+2');
	const total = Number(await page.locator('[data-total]').textContent());
	expect(total).toBeGreaterThanOrEqual(5);
	expect(total).toBeLessThanOrEqual(20);
	await expect(page.getByRole('list', { name: '' }).or(page.locator('ol'))).toContainText(
		'4d6kh3+2'
	);

	await page.getByRole('button', { name: '1d100' }).click();
	await expect(page.locator('ol li')).toHaveCount(2);
	await expect(page.locator('ol li').first()).toContainText('1d100');

	await input.fill('banana');
	await input.press('Enter');
	await expect(page.getByRole('alert')).toContainText('Bad term');
	await expect(page.locator('ol li')).toHaveCount(2);

	await page.getByRole('button', { name: 'Clear' }).click();
	await expect(page.getByText('Nothing rolled yet.')).toBeVisible();
});

test('combat: the tracker takes damage, marks bloodied and down, toggles conditions and follows the NPC', async ({
	page
}) => {
	await page.goto('/');
	const card = page.getByRole('article');
	const seed = page.getByRole('textbox', { name: 'Seed' });
	await seed.fill('7KQ2-M9XA');
	await seed.press('Enter');
	await page.getByRole('tab', { name: 'Combat NPC' }).click();
	const trackerPanel = card.locator('[data-section="tracker"]');
	await expect(trackerPanel).toBeVisible();
	await expect(trackerPanel).toContainText('Enter a maximum');

	const max = trackerPanel.getByRole('spinbutton', { name: 'Maximum hit points' });
	const hp = trackerPanel.getByRole('spinbutton', { name: 'Current hit points' });
	await max.fill('20');
	await max.press('Tab');
	await expect(hp).toHaveValue('20');

	await trackerPanel.getByRole('spinbutton', { name: 'Amount' }).fill('7');
	await trackerPanel.getByRole('button', { name: 'Damage 7' }).click();
	await expect(hp).toHaveValue('13');
	await expect(trackerPanel.locator('[data-status]')).toHaveCount(0);
	await trackerPanel.getByRole('button', { name: 'Damage 7' }).click();
	await expect(hp).toHaveValue('6');
	await expect(trackerPanel.locator('[data-status]')).toHaveText('Bloodied');
	await trackerPanel.getByRole('button', { name: 'Damage 7' }).click();
	await expect(hp).toHaveValue('0');
	await expect(trackerPanel.locator('[data-status]')).toHaveText('Down');
	await trackerPanel.getByRole('button', { name: 'Heal 7' }).click();
	await expect(hp).toHaveValue('7');

	const prone = trackerPanel.getByRole('button', { name: 'Prone' });
	await prone.click();
	await expect(prone).toHaveAttribute('aria-pressed', 'true');
	await trackerPanel.getByRole('button', { name: 'Stunned' }).click();

	// A reroll of one field is the same NPC: the tracker stays.
	await card.getByRole('button', { name: 'Reroll Tactics' }).click();
	await expect(hp).toHaveValue('7');
	await expect(prone).toHaveAttribute('aria-pressed', 'true');

	// Reset refills and clears conditions.
	await trackerPanel.getByRole('button', { name: 'Reset' }).click();
	await expect(hp).toHaveValue('20');
	await expect(prone).toHaveAttribute('aria-pressed', 'false');

	// A new NPC starts a fresh tracker.
	await page.getByRole('button', { name: 'Generate' }).click();
	await expect(trackerPanel).toContainText('Enter a maximum');
});
