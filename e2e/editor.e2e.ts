import { expect, test } from '@playwright/test';

test('editor: a customised table drives generation, filters narrow it, a customised adapter renders, packs export, import and revert', async ({
	page
}) => {
	// Customise the occupation table: the user copy replaces the default entries.
	await page.goto('/#/editor');
	await page.getByRole('button', { name: 'occupation', exact: true }).click();
	await page.getByRole('button', { name: 'Customise' }).click();
	await expect(page.getByRole('status')).toHaveText(/copied into your pack/);
	await page.getByRole('button', { name: 'Edit as JSON' }).click();
	await page
		.getByLabel('Table JSON')
		.fill(JSON.stringify({ entries: ['Probe occupation'], replace: true }));
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText(/Table saved/);
	await expect(page.getByRole('button', { name: /occupation customised/ })).toBeVisible();

	// Every generated NPC now has that occupation; a filter narrows the ancestry.
	await page.goto('/#/');
	const card = page.getByRole('article');
	await page.getByRole('button', { name: 'Generate', exact: true }).click();
	await expect(card).toContainText('Probe occupation');
	await page.getByRole('button', { name: /^Filters/ }).click();
	await page.getByRole('checkbox', { name: 'Dwarf' }).check();
	await expect(page.getByRole('button', { name: /^Filters/ })).toContainText('1');
	await expect(card.locator('[data-field="ancestry"]')).toContainText('Dwarf');
	await page.getByRole('button', { name: 'Generate', exact: true }).click();
	await expect(card.locator('[data-field="ancestry"]')).toContainText('Dwarf');
	await page.getByRole('button', { name: 'Clear filters' }).click();
	await expect(page.getByRole('button', { name: /^Filters/ })).not.toContainText('1');

	// Customise the d20 adapter: a label change shows in the rendered block under the same id.
	await page.goto('/#/editor');
	await page.getByRole('tab', { name: 'Adapters' }).click();
	await page.getByRole('button', { name: 'd20 fantasy' }).click();
	await page.getByRole('button', { name: 'Customise' }).click();
	const json = page.getByLabel('Adapter JSON');
	const text = await json.inputValue();
	expect(text).toContain('"hp": "Hit points"');
	await json.fill(
		text.replace('"hp": "Hit points"', '"hp": "Probe HP"').replace('"d20 fantasy"', '"My d20"')
	);
	await expect(page.getByText('Valid. Renders every sample NPC.')).toBeVisible();
	await expect(page.locator('[data-adapter-preview]')).toContainText('Probe HP');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText(/Adapter customised/);
	await expect(page.getByRole('button', { name: /My d20 customised/ })).toBeVisible();

	await page.goto('/#/');
	await page.getByRole('tab', { name: 'Combat NPC' }).click();
	await page.getByRole('combobox', { name: 'System' }).selectOption('d20');
	await expect(page.getByRole('combobox', { name: 'System' })).toContainText('My d20');
	await expect(card).toContainText('Probe HP');

	// Packs: both customisations are listed; one exports as a file; revert everything removes them.
	await page.goto('/#/editor');
	await page.getByRole('tab', { name: 'Packs' }).click();
	await expect(page.locator('[data-pack]')).toHaveCount(2);
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export My tables' }).click()
	]);
	expect(download.suggestedFilename()).toBe('strangerloom-tables-my-tables.json');
	const packPath = await download.path();
	await page.getByRole('button', { name: 'Revert everything to default' }).click();
	await page.getByRole('button', { name: 'Yes, revert everything' }).click();
	await expect(page.getByRole('status')).toHaveText(/back to default/);
	await expect(page.locator('[data-pack]')).toHaveCount(0);

	// The exported pack imports on its own and is in use again.
	await page.getByLabel('Import pack file').setInputFiles(packPath!);
	await expect(page.getByRole('status')).toHaveText(/Imported 1 pack/);
	await expect(page.locator('[data-pack]')).toHaveCount(1);
	await page.goto('/#/');
	await page.getByRole('tab', { name: 'Flavour NPC' }).click();
	await page.getByRole('button', { name: 'Generate', exact: true }).click();
	await expect(card).toContainText('Probe occupation');

	// Switching the pack off puts the default back without deleting it.
	await page.goto('/#/editor');
	await page.getByRole('tab', { name: 'Packs' }).click();
	await page.getByRole('checkbox', { name: 'Enable My tables' }).uncheck();
	await page.goto('/#/');
	await page.getByRole('button', { name: 'Generate', exact: true }).click();
	await expect(card).not.toContainText('Probe occupation');
});

test('editor: Duplicate makes an adapter under a new id that the System picker offers and the record screen renders', async ({
	page
}) => {
	await page.goto('/#/editor');
	await page.getByRole('tab', { name: 'Adapters' }).click();
	await page.getByRole('button', { name: 'd20 fantasy' }).click();
	await page.getByRole('button', { name: 'Duplicate' }).click();
	await page.getByRole('button', { name: 'Create copy' }).click();
	await expect(page.getByRole('alert')).toContainText(/lower-case letters/);
	await page.getByLabel('New id').fill('my-system');
	await page.getByLabel('Name', { exact: true }).fill('My system');
	await page.getByRole('button', { name: 'Create copy' }).click();
	await expect(page.getByRole('status')).toHaveText(/Adapter duplicated/);
	await expect(page.getByRole('button', { name: /^My system/ })).toBeVisible();

	// The copy renders in the generator and goes with the saved NPC into the record screen.
	await page.goto('/#/');
	const card = page.getByRole('article');
	await page.getByRole('tab', { name: 'Combat NPC' }).click();
	const system = page.getByRole('combobox', { name: 'System' });
	await system.selectOption('my-system');
	await expect(system).toHaveValue('my-system');
	await expect(card.locator('[data-view="full"]')).toBeVisible();
	const name = (await card.getByRole('heading', { level: 2 }).textContent())!;
	await page.keyboard.press('s');
	await expect(page.getByRole('status')).toHaveText(/Saved to the library/);

	await page.goto('/#/library');
	await page.locator('[data-record]').first().getByRole('link').click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
	await expect(page.locator('[data-view="full"]')).toBeVisible();
	await page
		.getByRole('group', { name: 'Stat block view' })
		.getByRole('button', { name: 'Compact' })
		.click();
	await expect(page.locator('[data-view="compact"]')).toBeVisible();
	await expect(page.locator('[data-view="full"]')).toHaveCount(0);

	// Deleting the copy puts the saved NPC back on the preset's default system.
	await page.goto('/#/editor');
	await page.getByRole('tab', { name: 'Adapters' }).click();
	await page.getByRole('button', { name: /^My system/ }).click();
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	await expect(page.getByRole('button', { name: /^My system/ })).toHaveCount(0);
	await page.goto('/#/library');
	await page.locator('[data-record]').first().getByRole('link').click();
	await expect(page.locator('[data-view]')).toBeVisible();
});
