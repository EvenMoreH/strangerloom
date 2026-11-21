import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	EMBED_THEME_KEY,
	embedThemeFromMessage,
	embedThemeFromSearch,
	isFollowing,
	offersFollow,
	shownTheme,
	withoutEmbedTheme,
	type FollowState
} from './embed';
import { parseTheme, THEME_IDS } from './themes';

describe('embedThemeFromSearch', () => {
	it('reads a theme id from the frame address', () => {
		for (const id of THEME_IDS) expect(embedThemeFromSearch(`?embed-theme=${id}`)).toBe(id);
		expect(embedThemeFromSearch('?lang=en&embed-theme=horror')).toBe('horror');
		expect(embedThemeFromSearch('embed-theme=dark')).toBe('dark');
	});

	it('ignores a missing parameter and anything that is not a theme id', () => {
		for (const search of [
			'',
			'?',
			'?theme=dark',
			'?embed-theme=',
			'?embed-theme=system',
			'?embed-theme=Horror',
			'?embed-theme=dark%20',
			'?embed-theme=%3Cscript%3E'
		])
			expect(embedThemeFromSearch(search), search).toBeNull();
	});
});

describe('withoutEmbedTheme', () => {
	it('drops the parameter and keeps the rest of the query', () => {
		expect(withoutEmbedTheme('')).toBe('');
		expect(withoutEmbedTheme('?embed-theme=dark')).toBe('');
		expect(withoutEmbedTheme('?a=1&embed-theme=dark&b=2')).toBe('?a=1&b=2');
		expect(withoutEmbedTheme('?a=1')).toBe('?a=1');
	});
});

describe('embedThemeFromMessage', () => {
	it('accepts a plain embed-theme message with a theme id', () => {
		for (const id of THEME_IDS)
			expect(embedThemeFromMessage({ type: 'embed-theme', theme: id })).toBe(id);
		expect(embedThemeFromMessage({ type: 'embed-theme', theme: 'sepia', extra: 1 })).toBe('sepia');
		expect(
			embedThemeFromMessage(
				Object.assign(Object.create(null), { type: 'embed-theme', theme: 'dark' })
			)
		).toBe('dark');
	});

	it('ignores everything else without throwing', () => {
		class Message {
			type = 'embed-theme';
			theme = 'dark';
		}
		const garbage: unknown[] = [
			undefined,
			null,
			0,
			'embed-theme',
			'{"type":"embed-theme","theme":"dark"}',
			true,
			[],
			['embed-theme', 'dark'],
			{},
			{ type: 'embed-theme' },
			{ theme: 'dark' },
			{ type: 'theme', theme: 'dark' },
			{ type: 'EMBED-THEME', theme: 'dark' },
			{ type: 'embed-theme', theme: 'system' },
			{ type: 'embed-theme', theme: 'Dark' },
			{ type: 'embed-theme', theme: 'neon' },
			{ type: 'embed-theme', theme: ['dark'] },
			{ type: 'embed-theme', theme: { toString: () => 'dark' } },
			new Message(),
			new Date(),
			() => 'dark'
		];
		for (const data of garbage) expect(embedThemeFromMessage(data)).toBeNull();
	});
});

describe('the follow decision', () => {
	const state = (over: Partial<FollowState>): FollowState => ({
		framed: true,
		follow: true,
		embedTheme: 'horror',
		...over
	});

	it('shows the embedded theme only inside a frame, with following on and a theme received', () => {
		expect(shownTheme(state({}), 'paper')).toBe('horror');
		expect(isFollowing(state({}))).toBe(true);
		expect(shownTheme(state({ framed: false }), 'paper')).toBe('paper');
		expect(shownTheme(state({ follow: false }), 'paper')).toBe('paper');
		expect(shownTheme(state({ embedTheme: null }), 'paper')).toBe('paper');
		expect(shownTheme(state({ embedTheme: null }), 'system')).toBe('system');
		expect(isFollowing(state({ framed: false }))).toBe(false);
		expect(isFollowing(state({ follow: false }))).toBe(false);
		expect(isFollowing(state({ embedTheme: null }))).toBe(false);
	});

	it('offers "Follow TallyHo" inside a frame once a theme has arrived, following or not', () => {
		expect(offersFollow(state({}))).toBe(true);
		expect(offersFollow(state({ follow: false }))).toBe(true);
		expect(offersFollow(state({ embedTheme: null }))).toBe(false);
		expect(offersFollow(state({ framed: false }))).toBe(false);
	});
});

// The first-paint script in index.html repeats the rule in plain JavaScript. It runs here against stand-ins for the
// browser objects it touches.
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
const run = new Function(
	'window',
	'localStorage',
	'sessionStorage',
	'location',
	'document',
	script
);

interface Paint {
	framed: boolean;
	/** The stored prefs: an object as JSON, a string as it is. */
	prefs?: object | string;
	search?: string;
	session?: string | null;
	sessionThrows?: boolean;
}

function firstPaint(p: Paint) {
	const self = {};
	let session = p.session ?? null;
	let theme: string | undefined;
	const stored = typeof p.prefs === 'string' ? p.prefs : p.prefs && JSON.stringify(p.prefs);
	run(
		{ self, top: p.framed ? {} : self },
		{ getItem: (key: string) => (key === 'strangerloom.prefs' ? (stored ?? null) : null) },
		{
			getItem(key: string) {
				if (p.sessionThrows) throw new Error('blocked');
				return key === EMBED_THEME_KEY ? session : null;
			},
			setItem(key: string, value: string) {
				if (p.sessionThrows) throw new Error('blocked');
				if (key === EMBED_THEME_KEY) session = value;
			}
		},
		{ search: p.search ?? '' },
		{
			documentElement: {
				setAttribute: (name: string, value: string) => {
					if (name === 'data-theme') theme = value;
				}
			}
		}
	);
	return { theme, session };
}

describe('the first-paint script', () => {
	it('outside a frame applies the saved theme and ignores the parameter', () => {
		expect(
			firstPaint({ framed: false, prefs: { theme: 'paper' }, search: '?embed-theme=horror' })
		).toEqual({ theme: 'paper', session: null });
		expect(firstPaint({ framed: false, search: '?embed-theme=horror' })).toEqual({
			theme: undefined,
			session: null
		});
	});

	it('inside a frame applies and keeps the parameter, or the kept theme', () => {
		expect(
			firstPaint({ framed: true, prefs: { theme: 'paper' }, search: '?embed-theme=horror' })
		).toEqual({ theme: 'horror', session: 'horror' });
		expect(
			firstPaint({
				framed: true,
				prefs: { theme: 'paper' },
				search: '?embed-theme=horror',
				session: 'frost'
			})
		).toEqual({ theme: 'horror', session: 'horror' });
		expect(firstPaint({ framed: true, prefs: { theme: 'paper' }, session: 'midnight' })).toEqual({
			theme: 'midnight',
			session: 'midnight'
		});
	});

	it('inside a frame with following off keeps the parameter but applies the saved theme', () => {
		expect(
			firstPaint({
				framed: true,
				prefs: { theme: 'paper', followEmbed: false },
				search: '?embed-theme=horror'
			})
		).toEqual({ theme: 'paper', session: 'horror' });
	});

	it('survives unknown values, broken prefs and blocked storage', () => {
		expect(
			firstPaint({
				framed: true,
				prefs: { theme: 'paper' },
				search: '?embed-theme=system',
				session: 'neon'
			})
		).toEqual({ theme: 'paper', session: 'neon' });
		expect(firstPaint({ framed: true, prefs: '{broken', search: '?embed-theme=lilac' })).toEqual({
			theme: 'lilac',
			session: 'lilac'
		});
		expect(firstPaint({ framed: true, prefs: 'null', search: '?embed-theme=lilac' }).theme).toBe(
			'lilac'
		);
		expect(
			firstPaint({
				framed: true,
				prefs: { theme: 'paper' },
				search: '?embed-theme=terminal',
				sessionThrows: true
			}).theme
		).toBe('terminal');
	});

	it('makes the same decision as the app', () => {
		const owns = ['paper', 'system', undefined, 'neon'];
		const searches = ['', '?embed-theme=horror', '?embed-theme=bogus'];
		const sessions = [null, 'midnight', 'bogus'];
		for (const framed of [true, false])
			for (const follow of [true, false, undefined])
				for (const own of owns)
					for (const search of searches)
						for (const session of sessions) {
							const prefs = { theme: own, followEmbed: follow };
							const kept = parseTheme(session);
							const embedTheme = framed
								? (embedThemeFromSearch(search) ?? (kept === 'system' ? null : kept))
								: null;
							const app = shownTheme(
								{ framed, follow: follow !== false, embedTheme },
								parseTheme(own)
							);
							const label = JSON.stringify({ framed, follow, own, search, session });
							expect(firstPaint({ framed, prefs, search, session }).theme, label).toBe(
								app === 'system' ? undefined : app
							);
						}
	});
});
