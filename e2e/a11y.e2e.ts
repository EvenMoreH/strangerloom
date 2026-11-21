import { expect, test } from '@playwright/test';

const screens = ['#/generate', '#/library', '#/tools', '#/editor', '#/settings'];

test('a11y: every control has a name and the accent focus ring', async ({ page }) => {
	for (const hash of screens) {
		await page.goto('/' + hash);
		await expect(page.getByRole('main')).toBeVisible();
		const unnamed = await page.evaluate(() => {
			const name = (el: Element) => {
				if (el.getAttribute('aria-label')) return true;
				const by = el.getAttribute('aria-labelledby');
				if (by && by.split(' ').some((id) => document.getElementById(id)?.textContent?.trim()))
					return true;
				if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return true;
				if (el.closest('label')?.textContent?.trim()) return true;
				return !!(el.textContent?.trim() || el.getAttribute('title'));
			};
			return [...document.querySelectorAll('button, a[href], input, select, textarea, summary')]
				.filter(
					(el) => (el as HTMLElement).offsetParent !== null || el.classList.contains('sr-only')
				)
				.filter((el) => !name(el))
				.map((el) => el.outerHTML.slice(0, 120));
		});
		expect(unnamed, hash).toEqual([]);
	}

	await page.goto('/');
	const accent = await page.evaluate(() => {
		const s = document.createElement('span');
		s.style.color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
		document.body.append(s);
		const out = getComputedStyle(s).color;
		s.remove();
		return out;
	});
	for (let i = 0; i < 12; i++) {
		await page.keyboard.press('Tab');
		const ring = await page.evaluate(() => {
			const cs = getComputedStyle(document.activeElement!);
			return `${document.activeElement!.tagName} ${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`;
		});
		expect(ring).toMatch(new RegExp(` solid 2px ${accent.replace(/[()]/g, '\\$&')}$`));
	}
});

test.describe('touch', () => {
	test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });

	test('a11y: on a touch device every control is at least 44 px', async ({ page }) => {
		await page.goto('/');
		expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
		await page.getByRole('tab', { name: 'Combat NPC' }).click();
		await expect(page.locator('[data-view]')).toBeVisible();
		const small = await page.evaluate(() =>
			[
				...document.querySelectorAll(
					'button, a[href], select, summary, input:not([type=checkbox]):not([type=radio]):not([type=file]), label:has(> input[type=checkbox]), label:has(> input[type=radio])'
				)
			]
				.map((el) => ({ el, r: el.getBoundingClientRect() }))
				.filter(({ r }) => r.width > 0 && r.height > 0 && r.height < 44)
				.map(
					({ el, r }) =>
						`${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`
				)
		);
		expect(small).toEqual([]);
	});
});
