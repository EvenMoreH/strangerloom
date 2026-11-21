import { expect, test } from '@playwright/test';

test('library: save, find, favourite, tag, open, export, import, roster, print and delete', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/');
	const card = page.getByRole('article');
	const seed = page.getByRole('textbox', { name: 'Seed' });
	await seed.fill('7KQ2-M9XA');
	await seed.press('Enter');
	const flavourName = (await card.getByRole('heading', { level: 2 }).textContent())!;

	// Save a flavour NPC with the button and a combat NPC with the key; the tracker state travels with it.
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText(/Saved to the library/);
	await card.getByRole('button', { name: 'Promote to combat NPC' }).click();
	await page.getByRole('combobox', { name: 'System' }).selectOption('d20');
	await card
		.locator('[data-section="tracker"]')
		.getByRole('button', { name: /^Damage/ })
		.click();
	const hpAfterDamage = await page
		.getByRole('spinbutton', { name: 'Current hit points' })
		.inputValue();
	const hpMax = await page.getByRole('spinbutton', { name: 'Maximum hit points' }).inputValue();
	expect(Number(hpAfterDamage)).toBeLessThan(Number(hpMax));
	await page.keyboard.press('s');
	await expect(page.getByRole('status')).toHaveText(/Saved to the library/);

	// Copy for TallyHo gives the 5e-style text.
	await page.getByRole('button', { name: 'Copy for TallyHo' }).click();
	await expect(page.getByRole('status')).toHaveText(/Copied for TallyHo/);
	const tallyho = await page.evaluate(() => navigator.clipboard.readText());
	expect(tallyho.split('\n')[0]).toBe(flavourName);
	expect(tallyho).toMatch(/^Hit Points \d+/m);
	expect(tallyho).toMatch(/Weapon Attack: \+\d+ to hit/);

	// A party too.
	await card.getByRole('button', { name: 'Build a party around them' }).click();
	const partyName = (await card.getByRole('heading', { level: 2 }).textContent())!;
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText(/Saved to the library/);

	// The library lists them; search and favourites filter.
	await page.getByRole('link', { name: 'Library' }).first().click();
	await expect(page.getByRole('tab', { name: /NPCs \(2\)/ })).toBeVisible();
	await expect(page.getByRole('tab', { name: /Parties \(1\)/ })).toBeVisible();
	const rows = page.locator('[data-record]');
	await expect(rows).toHaveCount(2);
	await expect(rows.first()).toContainText(flavourName);
	await page.getByRole('searchbox', { name: 'Search' }).fill('zzzzqqq');
	await expect(rows).toHaveCount(0);
	await expect(page.getByText('Nothing matches.')).toBeVisible();
	await page.getByRole('searchbox', { name: 'Search' }).fill(flavourName.split(' ')[0]);
	await expect(rows).toHaveCount(2);
	await page.getByRole('searchbox', { name: 'Search' }).fill('');
	await rows.first().getByRole('button', { name: 'Add to favourites' }).click();
	await page.getByRole('button', { name: 'Favourites', exact: true }).click();
	await expect(rows).toHaveCount(1);
	await page.getByRole('button', { name: 'Favourites', exact: true }).click();

	// The record view: tags and notes stick, the tag filter appears, the roster takes the NPC.
	await rows.first().getByRole('link').click();
	await expect(page).toHaveURL(/#\/npc\//);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(flavourName);
	await expect(page.getByText(/HP \d+\/\d+/)).toBeVisible();
	await page.getByRole('textbox', { name: 'Tags' }).fill('tavern, act 1');
	await page.getByRole('textbox', { name: 'Tags' }).press('Tab');
	await page.getByRole('textbox', { name: 'Notes' }).fill('owes the party a favour');
	await page.getByRole('textbox', { name: 'Notes' }).press('Tab');
	await page.getByRole('button', { name: 'Add to roster' }).click();
	await expect(page.getByRole('status')).toHaveText(/Added to the roster/);
	await page.getByRole('button', { name: 'Copy Markdown' }).click();
	const md = await page.evaluate(() => navigator.clipboard.readText());
	expect(md.startsWith(`# ${flavourName}`)).toBe(true);
	expect(md).toContain('## ');

	await page.reload();
	await expect(page.getByRole('textbox', { name: 'Tags' })).toHaveValue('tavern, act 1');
	await expect(page.getByRole('textbox', { name: 'Notes' })).toHaveValue('owes the party a favour');

	// The chronicle is folded to one line; an entry is dated, listed newest first and searchable.
	const chronicle = page.getByRole('button', { name: /^Chronicle/ });
	await expect(chronicle).toContainText('no entries yet');
	await chronicle.click();
	await page.getByRole('textbox', { name: 'Chronicle label' }).fill('Session 4');
	await page.getByRole('textbox', { name: 'Chronicle entry' }).fill('Met the party at the gate');
	await page.getByRole('button', { name: 'Add entry' }).click();
	await expect(page.getByRole('status')).toHaveText(/Chronicle entry added/);
	await expect(page.locator('[data-chronicle-entry]')).toHaveCount(1);
	await expect(chronicle).toContainText('1 entry');
	await expect(chronicle).toContainText('Session 4');
	await page.getByRole('textbox', { name: 'Chronicle entry' }).fill('Sold them a map');
	await page.getByRole('button', { name: 'Add entry' }).click();
	await expect(page.locator('[data-chronicle-entry] textarea').first()).toHaveValue(
		'Sold them a map'
	);
	await expect(chronicle).toContainText('2 entries');

	// Tags and notes survive a reload; the JSON download carries the record with them.
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'JSON file' }).click()
	]);
	expect(download.suggestedFilename()).toMatch(/\.json$/);
	const json = JSON.parse(
		await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString())
	);
	expect(json.npc.narrative.name.full).toBe(flavourName);
	expect(json.tags).toEqual(['tavern', 'act 1']);

	// Open in generator restores the recipe, the system and the tracker.
	await page.getByRole('button', { name: 'Open in generator' }).click();
	await expect(page).toHaveURL(/#\/$/);
	await expect(card.getByRole('heading', { level: 2 })).toHaveText(flavourName);
	await expect(page.getByRole('combobox', { name: 'System' })).toHaveValue('d20');
	await expect(seed).toHaveValue('7KQ2-M9XA');
	await expect(page.getByRole('spinbutton', { name: 'Current hit points' })).toHaveValue(
		hpAfterDamage
	);
	await expect(page.getByRole('spinbutton', { name: 'Maximum hit points' })).toHaveValue(hpMax);

	// Library filters by tag; the roster lists the NPC; the party record opens.
	await page.goto('/#/library');
	await page.getByRole('combobox', { name: 'Tag' }).selectOption('tavern');
	await expect(rows).toHaveCount(1);
	await page.getByRole('tab', { name: /Roster \(1\)/ }).click();
	await expect(page.locator('[data-roster]')).toHaveCount(1);
	await expect(page.locator('[data-roster]').first()).toContainText(flavourName);
	// The tag filter spans the tabs: no party carries it until it is cleared.
	await page.getByRole('tab', { name: /Parties/ }).click();
	await expect(rows).toHaveCount(0);
	await page.getByRole('combobox', { name: 'Tag' }).selectOption('');
	await expect(rows).toHaveCount(1);
	await rows.first().getByRole('link').click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(partyName);
	await expect(page.locator('[data-member]')).toHaveCount(4);
	await page.locator('[data-member]').first().getByRole('button').first().click();
	await expect(page.locator('[data-member]').first().locator('[data-view="full"]')).toBeVisible();

	// Export the library, delete the party, import the file back: the party returns with a new id, nothing doubles.
	await page.goto('/#/library');
	const [backup] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export backup' }).click()
	]);
	const backupPath = await backup.path();
	await page.getByRole('tab', { name: /Parties/ }).click();
	await rows.first().getByRole('link').click();
	await page.getByRole('button', { name: 'Delete' }).click();
	await page.getByRole('button', { name: 'Delete' }).click();
	await expect(page).toHaveURL(/#\/library$/);
	await expect(page.getByRole('tab', { name: /Parties \(0\)/ })).toBeVisible();
	await page.getByLabel('Import file').setInputFiles(backupPath!);
	await expect(page.getByRole('status')).toHaveText(
		/Imported 2 NPCs and 1 party \(2 given new ids\)/
	);
	await expect(page.getByRole('tab', { name: /NPCs \(4\)/ })).toBeVisible();
	await expect(page.getByRole('tab', { name: /Parties \(1\)/ })).toBeVisible();

	// The print view lists every shown NPC.
	await page.getByRole('tab', { name: /NPCs/ }).click();
	await page.getByRole('button', { name: 'Print shown' }).click();
	await expect(page).toHaveURL(/#\/print\/npc\//);
	await expect(page.locator('[data-print]')).toHaveCount(4);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Print 4 NPCs');
});
