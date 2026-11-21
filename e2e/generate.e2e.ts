import { expect, test } from '@playwright/test';

test('generate: seed drives the result, reroll moves one field, lock holds it, share link restores it', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/');
	const card = page.getByRole('article');
	await expect(card).toBeVisible();

	// A typed seed gives a known result on every run.
	const seed = page.getByRole('textbox', { name: 'Seed' });
	await seed.fill('7KQ2-M9XA');
	await seed.press('Enter');
	await expect(seed).toHaveValue('7KQ2-M9XA');
	const name = await card.getByRole('heading', { level: 2 }).textContent();
	const quirk = await card.locator('[data-field="quirk"] dd').textContent();
	const occupation = await card.locator('[data-field="occupation"] dd').textContent();

	// Rerolling the quirk changes only the quirk, also on a second reroll when every value is already known
	// to the session.
	const secret = await card.locator('[data-field="secret"] dd').textContent();
	const visual = await card.locator('[data-field="visual"] dd').textContent();
	await card.getByRole('button', { name: 'Reroll Quirk' }).click();
	await expect(card.locator('[data-field="quirk"] dd')).not.toHaveText(quirk!);
	await expect(card.getByRole('heading', { level: 2 })).toHaveText(name!);
	await expect(card.locator('[data-field="occupation"] dd')).toHaveText(occupation!);
	await card.getByRole('button', { name: 'Reroll Trait' }).click();
	await expect(card.getByRole('heading', { level: 2 })).toHaveText(name!);
	await expect(card.locator('[data-field="secret"] dd')).toHaveText(secret!);
	await expect(card.locator('[data-field="visual"] dd')).toHaveText(visual!);

	// A locked occupation survives a new seed.
	await card.getByRole('button', { name: 'Lock Occupation' }).click();
	await page.getByRole('button', { name: 'Generate' }).click();
	await expect(card.locator('[data-field="occupation"] dd')).toHaveText(occupation!);
	await expect(card.getByRole('heading', { level: 2 })).not.toHaveText(name!);
	await expect(seed).not.toHaveValue('7KQ2-M9XA');

	// The share link restores the same NPC.
	const shownName = await card.getByRole('heading', { level: 2 }).textContent();
	const shownSecret = await card.locator('[data-field="secret"] dd').textContent();
	await page.getByRole('button', { name: 'Share link' }).click();
	await expect(page.getByRole('status')).toHaveText(/Link copied/);
	const link = await page.evaluate(() => navigator.clipboard.readText());
	expect(link).toMatch(/#\/s\//);
	await page.goto('about:blank');
	await page.goto(link);
	await expect(card.getByRole('heading', { level: 2 })).toHaveText(shownName!);
	await expect(card.locator('[data-field="secret"] dd')).toHaveText(shownSecret!);
	await expect(card.locator('[data-field="occupation"] dd')).toHaveText(occupation!);
	await expect(page).toHaveURL(/#\/$/);
});

test('generate: a reroll always changes the field, even gender and ancestry', async ({ page }) => {
	await page.goto('/');
	const card = page.getByRole('article');
	await expect(card).toBeVisible();
	for (const field of ['gender', 'ancestry', 'age'] as const) {
		const dd = card.locator(`[data-field="${field}"] dd`);
		let before = await dd.textContent();
		for (let i = 0; i < 6; i++) {
			await card
				.locator(`[data-field="${field}"]`)
				.getByRole('button', { name: /^Reroll/ })
				.click();
			await expect(dd).not.toHaveText(before!);
			before = await dd.textContent();
		}
	}
});

test('generate: setting switch offers cultures and G rolls a new NPC', async ({ page }) => {
	await page.goto('/');
	const card = page.getByRole('article');
	await expect(card).toBeVisible();
	await page.getByLabel('Setting').selectOption('modern');
	await expect(page.getByLabel('Culture')).toBeVisible();
	// The ancestry row rerolls the culture, and its lock holds the culture through a new seed.
	const ancestryRow = card.locator('[data-field="ancestry"] dd');
	for (let i = 0; i < 4; i++) {
		const before = await ancestryRow.textContent();
		await card.getByRole('button', { name: 'Reroll Ancestry' }).click();
		await expect(ancestryRow).not.toHaveText(before!);
	}
	const held = await ancestryRow.textContent();
	await card.getByRole('button', { name: 'Lock Ancestry' }).click();
	await page.getByRole('button', { name: 'Generate' }).click();
	await expect(ancestryRow).toHaveText(held!);
	await card.getByRole('button', { name: 'Unlock Ancestry' }).click();
	await page.getByLabel('Culture').selectOption('polish');
	await expect(ancestryRow).toContainText('Polish');

	const before = await card.getByRole('heading', { level: 2 }).textContent();
	await page.locator('body').click();
	await page.keyboard.press('g');
	await expect(card.getByRole('heading', { level: 2 })).not.toHaveText(before!);
});

test('generate: fields can be hidden and the choice survives a reload', async ({ page }) => {
	await page.goto('/');
	const card = page.getByRole('article');
	await expect(card.locator('[data-field="voice"]')).toBeVisible();
	await page.getByRole('button', { name: 'Fields' }).click();
	await page.getByRole('checkbox', { name: 'Speaking' }).uncheck();
	await page.getByRole('checkbox', { name: 'Ideal' }).uncheck();
	await expect(card.locator('[data-field="voice"]')).toHaveCount(0);
	await expect(card.locator('[data-field="ideal"]')).toHaveCount(0);
	await expect(card.locator('[data-field="flaw"]')).toBeVisible();
	await expect(page.getByRole('button', { name: /Fields \(13\/15\)/ })).toBeVisible();

	// The blurb under the name reads as a sentence; hidden fields leave it too.
	const header = card.locator('header');
	const blurb = header.locator('p').first();
	await expect(blurb).toContainText(
		/^\w+, \d+, an? .+ (with|wearing|carrying) .+ who .+\. .+ towards people, .+ at the moment\.$/
	);
	const pronouns = await card.locator('[data-field="pronouns"] dd').textContent();
	const years = (await card.locator('[data-field="age"] dd').textContent())!.match(/\d+/)![0];
	await page.getByRole('checkbox', { name: 'Ancestry' }).uncheck();
	await page.getByRole('checkbox', { name: 'Age' }).uncheck();
	await page.getByRole('checkbox', { name: 'Pronouns' }).uncheck();
	await page.getByRole('checkbox', { name: 'Mood' }).uncheck();
	const ancestry = card.locator('[data-field="ancestry"] dd');
	await expect(ancestry).toHaveCount(0);
	await expect(blurb).toContainText(/^An? /);
	await expect(blurb).not.toContainText(new RegExp(`\\b${years}\\b`));
	await expect(blurb).not.toContainText('at the moment');
	await expect(header).not.toContainText(pronouns!);

	await page.reload();
	await expect(card).toBeVisible();
	await expect(card.locator('[data-field="voice"]')).toHaveCount(0);
	await page.getByRole('button', { name: 'Fields' }).click();
	await page.getByRole('button', { name: 'Show all' }).click();
	await expect(card.locator('[data-field="voice"]')).toBeVisible();
});

test('combat: promotion keeps the flavour, options drive the profile, compact view and share link work', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/');
	const card = page.getByRole('article');
	const seed = page.getByRole('textbox', { name: 'Seed' });
	await seed.fill('7KQ2-M9XA');
	await seed.press('Enter');
	const name = await card.getByRole('heading', { level: 2 }).textContent();
	const occupation = await card.locator('[data-field="occupation"] dd').textContent();

	await card.getByRole('button', { name: 'Promote to combat NPC' }).click();
	await expect(page.getByRole('tab', { name: 'Combat NPC' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(card.getByRole('heading', { level: 2 })).toHaveText(name!);
	await expect(card.locator('[data-field="occupation"] dd')).toHaveText(occupation!);
	await expect(card.locator('[data-section="header"]')).toBeVisible();
	await expect(card.locator('[data-section="competencies"] dd')).toHaveCount(6);

	await page.getByRole('combobox', { name: 'Archetype' }).selectOption('mage');
	await expect(card.locator('[data-section="header"]')).toContainText('Mage');
	await expect(card.locator('[data-section="header"]')).toContainText('Spellcaster');
	await page.getByRole('combobox', { name: 'Threat' }).selectOption('boss');
	await expect(card.locator('[data-section="header"]')).toContainText('Boss, power 5');
	await expect(card.locator('[data-section="abilities"] dd')).toHaveCount(3);
	await expect(card.locator('[data-section="offence"] [data-group]')).toHaveText([
		'At will',
		'Signature'
	]);
	await expect(card.locator('[data-section="offence"] dd')).toHaveCount(5);
	await expect(card.locator('[data-section="offence"] dd').first()).toContainText(
		/^(Melee|Ranged), \w+\. (Light|Medium|Heavy) damage(, [a-z]+)?\./
	);
	await expect(card.locator('[data-section="offence"] [data-section-note]')).toHaveText(
		'Light damage is like a dagger, medium like a sword, heavy like a greataxe.'
	);
	await expect(card.locator('[data-section="offence"] dd').last()).toContainText(/like an? /);

	const tactics = await card.locator('[data-section="tactics"] dd').textContent();
	const gear = await card.locator('[data-section="gear"] dd').first().textContent();
	await card.getByRole('button', { name: 'Lock Gear' }).click();
	await card.getByRole('button', { name: 'Reroll Tactics' }).click();
	await expect(card.locator('[data-section="tactics"] dd')).not.toHaveText(tactics!);
	await expect(card.locator('[data-section="header"]')).toContainText('Mage');
	await expect(card.getByRole('heading', { level: 2 })).toHaveText(name!);
	await expect(card.locator('[data-section="gear"] dd').first()).toHaveText(gear!);
	await expect(card.getByRole('button', { name: 'Unlock Gear' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await card.getByRole('button', { name: 'Reroll Competencies' }).click();
	await expect(card.getByRole('heading', { level: 2 })).toHaveText(name!);
	await expect(card.locator('[data-section="gear"] dd').first()).toHaveText(gear!);

	// The archetype padlock locks and unlocks; locking sets the option, unlocking puts it back to "any".
	await page.getByRole('combobox', { name: 'Archetype' }).selectOption('any');
	await card.getByRole('button', { name: 'Lock Archetype' }).click();
	await expect(page.getByRole('combobox', { name: 'Archetype' })).not.toHaveValue('any');
	await card.getByRole('button', { name: 'Unlock Archetype' }).click();
	await expect(page.getByRole('combobox', { name: 'Archetype' })).toHaveValue('any');
	await expect(card.getByRole('button', { name: 'Lock Archetype' })).toBeVisible();
	await page.getByRole('combobox', { name: 'Archetype' }).selectOption('mage');

	await page.getByRole('button', { name: 'Compact' }).click();
	const compact = card.locator('[data-view="compact"]');
	await expect(compact).toBeVisible();
	await expect(compact).toContainText('Mage | Boss | power 5');
	await expect(compact).toContainText('Stealth');
	// Descriptions are revealed by tapping the name (hover shows them too on devices with a pointer).
	await page.mouse.move(0, 0);
	const signature = compact.locator('li:has([data-reveal])').first();
	const reveal = signature.locator('[data-reveal]');
	await expect(reveal).toBeHidden();
	const attackName = signature.getByRole('button').first();
	await attackName.click();
	await expect(attackName).toHaveAttribute('aria-expanded', 'true');
	await expect(reveal).toBeVisible();
	await page.mouse.move(0, 0);
	await expect(reveal).toBeVisible();
	await attackName.click();
	await page.mouse.move(0, 0);
	await expect(reveal).toBeHidden();

	await page.getByRole('button', { name: 'Share link' }).click();
	await expect(page.getByRole('status')).toHaveText(/Link copied/);
	const link = await page.evaluate(() => navigator.clipboard.readText());
	await page.goto('about:blank');
	await page.goto(link);
	await expect(page.getByRole('tab', { name: 'Combat NPC' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(card.getByRole('heading', { level: 2 })).toHaveText(name!);
	await expect(card.locator('[data-section="header"]')).toContainText('Boss, power 5');

	await page.getByRole('tab', { name: 'Flavour NPC' }).click();
	await expect(card.locator('[data-section="header"]')).toHaveCount(0);
	await expect(card.getByRole('heading', { level: 2 })).toHaveText(name!);
});

test('adapters: the system picker renders d20 and old-school blocks, overrides feed the tracker', async ({
	page
}) => {
	await page.goto('/');
	const card = page.getByRole('article');
	const seed = page.getByRole('textbox', { name: 'Seed' });
	await seed.fill('7KQ2-M9XA');
	await seed.press('Enter');
	await page.getByRole('tab', { name: 'Combat NPC' }).click();
	await expect(card.locator('[data-section="offence"]')).toBeVisible();

	const system = page.getByRole('combobox', { name: 'System' });
	await expect(system).toHaveValue('generic');
	await system.selectOption('d20');
	const defence = card.locator('[data-section="defence"]');
	await expect(defence).toContainText('Hit points');
	await expect(defence).toContainText('Armour class');
	await expect(card.locator('[data-section="offence"] dd').first()).toContainText(
		/to hit, \d+d\d+/
	);
	const hp = await defence.locator('dd').first().locator('span').first().textContent();
	await expect(page.getByRole('spinbutton', { name: 'Maximum hit points' })).toHaveValue(
		hp!.trim()
	);

	// Overriding the hit point line moves the tracker's maximum and can be reset.
	await card.getByRole('button', { name: 'Edit Hit points' }).click();
	const input = card.getByRole('textbox', { name: 'Hit points value' });
	await input.fill('31');
	await input.press('Enter');
	await expect(defence.locator('[data-overridden]')).toHaveText('31');
	await expect(page.getByRole('spinbutton', { name: 'Maximum hit points' })).toHaveValue('31');
	await card.getByRole('button', { name: 'Reset Hit points' }).click();
	await expect(defence.locator('[data-overridden]')).toHaveCount(0);
	await expect(page.getByRole('spinbutton', { name: 'Maximum hit points' })).toHaveValue(
		hp!.trim()
	);

	await system.selectOption('osr');
	await expect(card.locator('[data-section="header"]')).toContainText('THAC0');
	await expect(defence.locator('dd').nth(1)).toContainText(/\d+ \[\d+\]/);

	// The choice survives a reload.
	await page.reload();
	await page.getByRole('tab', { name: 'Combat NPC' }).click();
	await expect(page.getByRole('combobox', { name: 'System' })).toHaveValue('osr');
	await expect(card.locator('[data-section="header"]')).toContainText('THAC0');
});

test('generate: the sci-fi preset frames the culture as heritage, modern lists it plainly', async ({
	page
}) => {
	await page.goto('/');
	const card = page.getByRole('article');
	const ancestry = card.locator('[data-field="ancestry"] dd');
	const blurb = card.locator('header p').first();
	await page.getByLabel('Setting').selectOption('sci-fi');
	await expect(ancestry).toHaveText(/^\w+ of .+ heritage$/);
	await expect(blurb).toContainText(/^\w+ of .+ heritage, \d+, an? /);
	await page.getByLabel('Setting').selectOption('modern');
	await expect(ancestry).toHaveText(/^\w+, .+$/);
	await expect(ancestry).not.toContainText('heritage');
	await page.getByLabel('Setting').selectOption('high-fantasy');
	await expect(ancestry).toHaveText(/^\w+$/);
});

test('generate: the Copy blurb icon after the name copies the name, the combat summary and the blurb', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/');
	const card = page.getByRole('article');
	const name = (await card.getByRole('heading', { level: 2 }).textContent())!;
	await card.getByRole('button', { name: 'Copy blurb' }).click();
	await expect(page.getByRole('status').first()).toHaveText(/Blurb copied/);
	let lines = (await page.evaluate(() => navigator.clipboard.readText())).split('\n');
	expect(lines).toHaveLength(2);
	expect(lines[0]).toBe(name);
	expect(lines[1]).toMatch(/^\w+, \d+, an? /);

	await card.getByRole('button', { name: 'Promote to combat NPC' }).click();
	await card.getByRole('button', { name: 'Copy blurb' }).click();
	lines = (await page.evaluate(() => navigator.clipboard.readText())).split('\n');
	expect(lines).toHaveLength(3);
	expect(lines[0]).toBe(name);
	expect(lines[1]).toMatch(/^.+ \| (Minion|Standard|Elite|Boss) \| power \d+$/);
});
