import { expect, test, type Frame, type Page } from '@playwright/test';

// Theme following: the app inside a frame of another origin takes the embedder's theme from the frame address and
// from posted messages. The embedding page is written by the test into the blank page (a page served from a made-up
// origin would be stopped by the browser's local network checks when it frames localhost).
test.use({ serviceWorkers: 'block' });

const message = (theme: unknown) => ({ type: 'embed-theme', theme });

/** Opens a page of another origin with the app at `path` in a frame named `app`, and a second frame `other`. */
async function embed(page: Page, baseURL: string, path: string): Promise<Frame> {
	const src = new URL(path, baseURL).href;
	await page.setContent(
		`<iframe name="app" src="${src}" style="width: 1100px; height: 640px; border: 0"></iframe>
		<iframe name="other" srcdoc="<p>Another frame</p>"></iframe>`
	);
	const frame = page.frame({ name: 'app' });
	if (!frame) throw new Error('No app frame');
	await expect(frame.getByRole('heading', { name: 'Settings' })).toBeVisible();
	return frame;
}

/** The embedder posts a message to the app frame, as TallyHo does. */
const post = (page: Page, data: unknown) =>
	page.evaluate((data) => {
		const frame = document.querySelector<HTMLIFrameElement>('iframe[name="app"]');
		frame?.contentWindow?.postMessage(data, '*');
	}, data);

/** Counts the messages the frame receives, so a test can wait until ignored ones have been handled. */
const countMessages = (frame: Frame) =>
	frame.evaluate(() => {
		const w = window as unknown as { seen: number };
		w.seen = 0;
		addEventListener('message', () => w.seen++);
	});
const seen = (frame: Frame) => frame.evaluate(() => (window as unknown as { seen: number }).seen);

async function reload(page: Page, frame: Frame) {
	const navigated = page.waitForEvent('framenavigated', (f) => f === frame);
	await frame.evaluate(() => location.reload());
	await navigated;
	await frame.waitForLoadState();
}

const savedPrefs = (frame: Frame) =>
	frame.evaluate(() => JSON.parse(localStorage.getItem('strangerloom.prefs') || '{}'));

/** The root's theme, colour scheme and theme-color tags, colours as the browser computes them. */
const rootState = (frame: Frame) =>
	frame.evaluate(() => {
		const probe = document.createElement('span');
		document.body.append(probe);
		const rgb = (colour: string) => {
			probe.style.color = colour;
			return getComputedStyle(probe).color;
		};
		const style = getComputedStyle(document.documentElement);
		const state = {
			theme: document.documentElement.getAttribute('data-theme'),
			scheme: style.colorScheme,
			metas: [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) =>
				rgb(m.content)
			)
		};
		probe.remove();
		return state;
	});

const radioLabels = (frame: Frame | Page) =>
	frame
		.getByRole('group', { name: 'Theme' })
		.getByRole('radio')
		.evaluateAll((els) => els.map((el) => el.closest('label')?.textContent?.trim()));

test('theme following: the frame paints with the embedded theme and follows messages from the parent only', async ({
	page,
	baseURL
}) => {
	const frame = await embed(page, baseURL!, '/?embed-theme=horror#/settings');
	const html = frame.locator('html');
	// The app's own saved theme inside the frame.
	await frame.evaluate(() =>
		localStorage.setItem('strangerloom.prefs', JSON.stringify({ theme: 'paper' }))
	);

	// First paint: the parameter wins before the app script runs.
	await page.route(/\/(src\/main\.ts|assets\/index-[\w-]+\.js)$/, (route) => route.abort());
	await reload(page, frame);
	await expect(html).toHaveAttribute('data-theme', 'horror');
	await expect(frame.locator('#app')).toBeEmpty();
	await page.unroute(/\/(src\/main\.ts|assets\/index-[\w-]+\.js)$/);

	await reload(page, frame);
	await expect(frame.getByRole('heading', { name: 'Settings' })).toBeVisible();
	expect(await rootState(frame)).toEqual({
		theme: 'horror',
		scheme: 'dark',
		metas: ['rgb(17, 18, 18)', 'rgb(17, 18, 18)']
	});
	expect((await radioLabels(frame))[0]).toBe('Follow TallyHo');
	const follow = frame.getByRole('radio', { name: 'Follow TallyHo' });
	await expect(follow).toBeChecked();
	await expect(frame.getByRole('radio', { name: 'Paper', exact: true })).not.toBeChecked();

	// A message from the parent switches the theme without a reload.
	await post(page, message('frost'));
	await expect(html).toHaveAttribute('data-theme', 'frost');
	expect(await rootState(frame)).toEqual({
		theme: 'frost',
		scheme: 'light',
		metas: ['rgb(243, 245, 248)', 'rgb(243, 245, 248)']
	});

	// Garbage from the parent and valid messages from any other window change nothing.
	await countMessages(frame);
	const garbage = [
		'embed-theme',
		'{"type":"embed-theme","theme":"terminal"}',
		42,
		null,
		[],
		['embed-theme', 'terminal'],
		{},
		{ type: 'embed-theme' },
		{ type: 'theme', theme: 'terminal' },
		message('neon'),
		message('system'),
		message('Terminal'),
		message(['terminal'])
	];
	for (const data of garbage) await post(page, data);
	await page
		.frame({ name: 'other' })!
		.evaluate(() =>
			document
				.defaultView!.parent.document.querySelector<HTMLIFrameElement>('iframe[name="app"]')!
				.contentWindow!.postMessage({ type: 'embed-theme', theme: 'terminal' }, '*')
		);
	await frame.evaluate(() => postMessage({ type: 'embed-theme', theme: 'terminal' }, '*'));
	await expect.poll(() => seen(frame)).toBe(garbage.length + 2);
	await expect(html).toHaveAttribute('data-theme', 'frost');
	await expect(frame.getByRole('heading', { name: 'Settings' })).toBeVisible();

	// Following never writes the app's own theme.
	expect(await savedPrefs(frame)).toEqual({ theme: 'paper' });

	// A later load of the frame without the parameter keeps the last theme sent in this tab.
	await frame.goto(new URL('/#/settings', baseURL).href);
	await expect(frame.getByRole('heading', { name: 'Settings' })).toBeVisible();
	await expect(html).toHaveAttribute('data-theme', 'frost');
});

test('theme following: picking a theme stops following, "Follow TallyHo" takes it back up', async ({
	page,
	baseURL
}) => {
	const frame = await embed(page, baseURL!, '/?embed-theme=midnight#/settings');
	const html = frame.locator('html');
	await expect(html).toHaveAttribute('data-theme', 'midnight');
	const follow = frame.getByRole('radio', { name: 'Follow TallyHo' });
	await expect(follow).toBeChecked();
	// The tile previews the theme it follows.
	await expect(frame.locator('label:has(input[value="follow"])')).toHaveAttribute(
		'data-theme',
		'midnight'
	);

	await frame.getByRole('radio', { name: 'Graphite', exact: true }).check();
	await expect(html).toHaveAttribute('data-theme', 'graphite');
	await expect(follow).not.toBeChecked();
	expect(await savedPrefs(frame)).toMatchObject({ theme: 'graphite', followEmbed: false });

	// While not following, messages are remembered but not shown.
	await countMessages(frame);
	await post(page, message('cyberpunk'));
	await expect.poll(() => seen(frame)).toBe(1);
	await expect(html).toHaveAttribute('data-theme', 'graphite');
	await expect(frame.locator('label:has(input[value="follow"])')).toHaveAttribute(
		'data-theme',
		'cyberpunk'
	);

	// Following stays off over a reload, even with the parameter in the address.
	await reload(page, frame);
	await expect(frame.getByRole('heading', { name: 'Settings' })).toBeVisible();
	await expect(html).toHaveAttribute('data-theme', 'graphite');
	await expect(frame.getByRole('radio', { name: 'Graphite', exact: true })).toBeChecked();

	await follow.check();
	// The reload put the address's theme back as the last one sent.
	await expect(html).toHaveAttribute('data-theme', 'midnight');
	await post(page, message('sepia'));
	await expect(html).toHaveAttribute('data-theme', 'sepia');
	expect(await savedPrefs(frame)).toMatchObject({ theme: 'graphite', followEmbed: true });

	// Match system counts as a pick too.
	await frame.getByRole('radio', { name: 'Match system' }).check();
	await expect(html).not.toHaveAttribute('data-theme');
	expect(await savedPrefs(frame)).toMatchObject({ theme: 'system', followEmbed: false });
});

test('theme following: "Follow TallyHo" appears in a frame once a theme arrives, never in a tab of its own', async ({
	page,
	context,
	baseURL
}) => {
	const frame = await embed(page, baseURL!, '/#/settings');
	expect((await radioLabels(frame))[0]).toBe('Match system');
	await expect(frame.getByRole('radio', { name: 'Follow TallyHo' })).toHaveCount(0);
	await post(page, message('candlelight'));
	await expect(frame.getByRole('radio', { name: 'Follow TallyHo' })).toBeChecked();
	await expect(frame.locator('html')).toHaveAttribute('data-theme', 'candlelight');

	// In a tab of its own the parameter and messages are ignored.
	const tab = await context.newPage();
	await tab.goto('/#/settings');
	await tab.evaluate(() =>
		localStorage.setItem('strangerloom.prefs', JSON.stringify({ theme: 'lilac' }))
	);
	await tab.goto('/?embed-theme=horror#/settings');
	await expect(tab.getByRole('heading', { name: 'Settings' })).toBeVisible();
	await expect(tab.locator('html')).toHaveAttribute('data-theme', 'lilac');
	expect((await radioLabels(tab))[0]).toBe('Match system');
	await expect(tab.getByRole('radio', { name: 'Follow TallyHo' })).toHaveCount(0);
	await countMessages(tab.mainFrame());
	await tab.evaluate(() => postMessage({ type: 'embed-theme', theme: 'terminal' }, '*'));
	await expect.poll(() => seen(tab.mainFrame())).toBe(1);
	await expect(tab.locator('html')).toHaveAttribute('data-theme', 'lilac');
	expect(await tab.evaluate(() => sessionStorage.getItem('strangerloom.embedTheme'))).toBeNull();
});
