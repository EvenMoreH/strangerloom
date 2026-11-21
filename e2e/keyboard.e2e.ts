import { expect, test } from '@playwright/test';

test('keyboard: G, R, L and S act on the focused field, Enter rolls, nothing fires inside an input', async ({
	page
}) => {
	await page.goto('/');
	const card = page.getByRole('article');
	const name = card.getByRole('heading', { level: 2 });
	const quirk = card.locator('[data-field="quirk"] dd');

	// G generates.
	const first = await name.textContent();
	await page.locator('body').click();
	await page.keyboard.press('g');
	await expect(name).not.toHaveText(first!);

	// R rerolls the field whose control has focus; the other fields stay.
	const nameAfterG = await name.textContent();
	const quirkBefore = await quirk.textContent();
	await card.getByRole('button', { name: 'Reroll Quirk' }).focus();
	await page.keyboard.press('r');
	await expect(quirk).not.toHaveText(quirkBefore!);
	await expect(name).toHaveText(nameAfterG!);

	// L locks the focused field, which then survives a generate; L again unlocks it.
	const quirkHeld = await quirk.textContent();
	await page.keyboard.press('l');
	await expect(card.getByRole('button', { name: 'Unlock Quirk' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.keyboard.press('g');
	await expect(quirk).toHaveText(quirkHeld!);
	await card.getByRole('button', { name: 'Unlock Quirk' }).focus();
	await page.keyboard.press('l');
	await expect(card.getByRole('button', { name: 'Lock Quirk' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);

	// S saves to the library.
	await page.keyboard.press('s');
	await expect(page.getByRole('status').first()).toHaveText(/Saved to the library/);

	// Inside an input the letters are text, not shortcuts.
	const seed = page.getByRole('textbox', { name: 'Seed' });
	const nameBeforeTyping = await name.textContent();
	await seed.click();
	await seed.press('End');
	await seed.press('g');
	await expect(name).toHaveText(nameBeforeTyping!);
	await expect(seed).toHaveValue(/g$/i);

	// Enter on a focused roll string rolls it and the result lands in the live region.
	await page.goto('/');
	await page.getByRole('tab', { name: 'Combat NPC' }).click();
	// The generic card carries no dice; the d20 adapter does.
	await page.getByRole('combobox', { name: 'System' }).selectOption('d20');
	const roll = card.locator('button[data-roll]').first();
	const label = (await roll.getAttribute('aria-label'))!.replace(/^Roll /, '').replace(/:.*$/, '');
	await roll.focus();
	await page.keyboard.press('Enter');
	await expect(card.locator('[data-last-roll]')).toContainText(label);
});
