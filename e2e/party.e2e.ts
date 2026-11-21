import { expect, test } from '@playwright/test';

test('party: a combat NPC becomes member 0, party fields and members reroll alone, initiative orders them', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/');
	const card = page.getByRole('article');
	const seed = page.getByRole('textbox', { name: 'Seed' });
	await seed.fill('7KQ2-M9XA');
	await seed.press('Enter');
	await card.getByRole('button', { name: 'Promote to combat NPC' }).click();
	const name = await card.getByRole('heading', { level: 2 }).textContent();

	// Promotion keeps the NPC as the first, locked member.
	await card.getByRole('button', { name: 'Build a party around them' }).click();
	await expect(page.getByRole('tab', { name: 'Party' })).toHaveAttribute('aria-selected', 'true');
	const members = card.locator('[data-member]');
	const first = card.locator('[data-member="0"]');
	await expect(members).toHaveCount(4);
	await expect(first).toContainText(name!);
	await expect(first.getByRole('button', { name: /^Unlock member/ })).toBeVisible();
	// The leader is listed first.
	await expect(card.locator('[data-leader]')).toHaveCount(1);
	await expect(members.first().locator('[data-leader]')).toBeVisible();
	expect(await card.locator('[data-section="relationships"] li').count()).toBeGreaterThanOrEqual(3);

	// A field of the locked, promoted member rerolls on its own; the rest of the member stays.
	await first.getByRole('button', { name: /^Expand/ }).click();
	await expect(first.getByRole('button', { name: 'Unlock Quirk' })).toBeVisible();
	const promotedQuirk = await first.locator('[data-field="quirk"] dd').textContent();
	const promotedBond = await first.locator('[data-field="bond"] dd').textContent();
	await first.getByRole('button', { name: 'Reroll Quirk' }).click();
	await expect(first.locator('[data-field="quirk"] dd')).not.toHaveText(promotedQuirk!);
	await expect(first.locator('[data-field="bond"] dd')).toHaveText(promotedBond!);
	await expect(first).toContainText(name!);
	await first.getByRole('button', { name: /^Collapse/ }).click();

	// Rerolling the leader hands the lead to another member.
	const leaderName = await card.locator('[data-field="party.leader"] dd').textContent();
	await card.getByRole('button', { name: 'Reroll Leader' }).click();
	await expect(card.locator('[data-field="party.leader"] dd')).not.toHaveText(leaderName!);
	await expect(members.first().locator('[data-leader]')).toBeVisible();

	// Party size is an option.
	await page.getByRole('combobox', { name: 'Party size' }).selectOption('6');
	await expect(members).toHaveCount(6);
	await expect(first).toContainText(name!);
	await page.getByRole('combobox', { name: 'Party size' }).selectOption('3');
	await expect(members).toHaveCount(3);

	// Rerolling the goal leaves the name, the members and the other fields alone.
	const partyName = await card.getByRole('heading', { level: 2 }).textContent();
	const goal = await card.locator('[data-field="party.goal"] dd').textContent();
	const hook = await card.locator('[data-field="party.hook"] dd').textContent();
	const memberNames = await members.locator('[data-member-name]').allTextContents();
	await card.getByRole('button', { name: 'Reroll Goal' }).click();
	await expect(card.locator('[data-field="party.goal"] dd')).not.toHaveText(goal!);
	await expect(card.locator('[data-field="party.hook"] dd')).toHaveText(hook!);
	await expect(card.getByRole('heading', { level: 2 })).toHaveText(partyName!);
	expect(await members.locator('[data-member-name]').allTextContents()).toEqual(memberNames);

	// Rerolling one member changes that member only; a locked party name survives a new seed.
	const second = card.locator('[data-member="1"]');
	const secondName = await second.locator('[data-member-name]').textContent();
	const third = card.locator('[data-member="2"]');
	const thirdName = await third.locator('[data-member-name]').textContent();
	await second.getByRole('button', { name: /^Reroll member/ }).click();
	await expect(second.locator('[data-member-name]')).not.toHaveText(secondName!);
	await expect(third.locator('[data-member-name]')).toHaveText(thirdName!);
	await expect(first).toContainText(name!);
	await card.getByRole('button', { name: 'Lock Party name' }).click();
	await page.getByRole('button', { name: 'Generate' }).click();
	await expect(card.getByRole('heading', { level: 2 })).toHaveText(partyName!);
	await expect(first).toContainText(name!);
	await expect(members.first().locator('[data-leader]')).toBeVisible();
	await expect(third.locator('[data-member-name]')).not.toHaveText(thirdName!);

	// A member opens to its fields and stat block; its quirk rerolls on its own.
	await third.getByRole('button', { name: /^Expand/ }).click();
	await expect(third.locator('[data-field="quirk"] dd')).toBeVisible();
	await expect(third.locator('[data-view="full"]')).toBeVisible();
	const quirk = await third.locator('[data-field="quirk"] dd').textContent();
	const visual = await third.locator('[data-field="visual"] dd').textContent();
	await third.getByRole('button', { name: 'Reroll Quirk' }).click();
	await expect(third.locator('[data-field="quirk"] dd')).not.toHaveText(quirk!);
	await expect(third.locator('[data-field="visual"] dd')).toHaveText(visual!);
	await expect(third.locator('[data-member-name]')).toHaveText(
		(await third.locator('[data-member-name]').textContent())!
	);

	// Initiative lists every member once, highest first.
	await card.getByRole('button', { name: 'Roll initiative' }).click();
	const order = card.getByRole('list', { name: 'Initiative order' }).getByRole('listitem');
	await expect(order).toHaveCount(3);
	const totals = (await order.locator('.font-mono').allTextContents()).map(Number);
	expect(totals).toEqual([...totals].sort((a, b) => b - a));
	await card.getByRole('button', { name: 'Clear' }).click();
	await expect(order).toHaveCount(0);

	// Copy blurb: the name with the Leader tag, the combat summary, the blurb.
	const leaderRow = members.filter({ has: page.locator('[data-leader]') }).first();
	const leadName = (await leaderRow.locator('[data-member-name]').textContent())!;
	await leaderRow.getByRole('button', { name: /^More actions/ }).click();
	await page.getByRole('menuitem', { name: 'Copy blurb' }).click();
	await expect(page.getByRole('status')).toHaveText(/blurb copied/);
	const blurbLines = (await page.evaluate(() => navigator.clipboard.readText())).split('\n');
	expect(blurbLines).toHaveLength(3);
	expect(blurbLines[0]).toBe(`${leadName} | Leader`);
	expect(blurbLines[1]).toMatch(/^.+ \| (Minion|Standard|Elite|Boss) \| power \d+$/);
	expect(blurbLines[2]).toMatch(/^\w+, \d+, an? /);

	// One member can leave the party on its own: copied for TallyHo and saved as an NPC.
	const thirdName2 = (await third.locator('[data-member-name]').textContent())!;
	await third.getByRole('button', { name: /^More actions/ }).click();
	await page.getByRole('menuitem', { name: 'Copy for TallyHo' }).click();
	await expect(page.getByRole('status')).toHaveText(/copied for TallyHo/);
	expect((await page.evaluate(() => navigator.clipboard.readText())).split('\n')[0]).toBe(
		thirdName2
	);
	await third.getByRole('button', { name: /^More actions/ }).click();
	await page.getByRole('menuitem', { name: 'Save as NPC' }).click();
	await expect(page.getByRole('status')).toHaveText(/saved as an NPC/);
	await expect(members).toHaveCount(3);

	// Copy as text carries the party and every member; the share link restores the party.
	await page.getByRole('button', { name: 'Copy as text' }).click();
	await expect(page.getByRole('status')).toHaveText(/Text copied/);
	const text = await page.evaluate(() => navigator.clipboard.readText());
	expect(text).toContain(partyName!);
	expect(text).toContain('Relationships');
	expect(text.match(/^== /gm)).toHaveLength(3);
	await page.getByRole('button', { name: 'Share link' }).click();
	await expect(page.getByRole('status')).toHaveText(/Link copied/);
	const link = await page.evaluate(() => navigator.clipboard.readText());
	await page.goto('about:blank');
	await page.goto(link);
	await expect(page.getByRole('tab', { name: 'Party' })).toHaveAttribute('aria-selected', 'true');
	await expect(card.getByRole('heading', { level: 2 })).toHaveText(partyName!);
	await expect(members).toHaveCount(3);
	await expect(first).toContainText(name!);

	// The saved member is a standalone combat NPC with the same name; opened in the generator it stands alone.
	await page.goto('/#/library');
	const rows = page.locator('[data-record]');
	await expect(rows).toHaveCount(1);
	await expect(rows.first()).toContainText(thirdName2);
	await rows.first().getByRole('link').click();
	await page.getByRole('button', { name: 'Open in generator' }).click();
	await expect(page.getByRole('tab', { name: 'Combat NPC' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(card.getByRole('heading', { level: 2 })).toHaveText(thirdName2);
});

test('party: a member opens alone as a combat NPC in the generator', async ({ page }) => {
	await page.goto('/');
	const card = page.getByRole('article');
	const seed = page.getByRole('textbox', { name: 'Seed' });
	await seed.fill('7KQ2-M9XA');
	await seed.press('Enter');
	await card.getByRole('button', { name: 'Promote to combat NPC' }).click();
	await card.getByRole('button', { name: 'Build a party around them' }).click();
	const second = card.locator('[data-member="1"]');
	const memberName = (await second.locator('[data-member-name]').textContent())!;

	await second.getByRole('button', { name: /^More actions/ }).click();
	await page.getByRole('menuitem', { name: 'Open as combat NPC' }).click();
	await expect(page.getByRole('tab', { name: 'Combat NPC' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(card.getByRole('heading', { level: 2 })).toHaveText(memberName);
	await expect(card.locator('[data-member]')).toHaveCount(0);
	await expect(card.locator('[data-view]')).toBeVisible();

	// The NPC stands alone: a reroll of its quirk changes only this card, and Generate makes a new NPC.
	const quirk = card.locator('[data-field="quirk"] dd');
	const before = await quirk.textContent();
	await card.getByRole('button', { name: 'Reroll Quirk' }).click();
	await expect(quirk).not.toHaveText(before!);
	await expect(card.getByRole('heading', { level: 2 })).toHaveText(memberName);
});
