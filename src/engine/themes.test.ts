import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	DARK_THEMES,
	LIGHT_THEMES,
	parseTheme,
	THEME_CHOICES,
	THEME_IDS,
	THEMES,
	type ThemeId
} from './themes';

// The colours live in the stylesheet. These tests read it, so a theme edited later cannot quietly become unreadable.
const css = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8');

const TOKENS = [
	'surface',
	'surface-2',
	'surface-3',
	'border',
	'border-strong',
	'ink',
	'ink-muted',
	'accent',
	'accent-fill',
	'accent-ink',
	'danger'
] as const;
type Palette = Record<(typeof TOKENS)[number], string>;

/** The body of the rule whose selector is `selector` (the selector must be followed by its `{`). */
function rule(selector: string): string {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
	if (!match) throw new Error(`No rule for ${selector}`);
	return match[1];
}

/** The custom properties a rule declares. */
function declarations(selector: string): Record<string, string> {
	return Object.fromEntries(
		[...rule(selector).matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [
			m[1],
			m[2].replace(/\s+/g, ' ').trim()
		])
	);
}

function palette(selector: string): Palette {
	const found = declarations(selector);
	for (const token of TOKENS)
		expect(found[token], `${selector} --${token}`).toMatch(/^#[0-9a-f]{6}$/i);
	return found as Palette;
}

const luminance = (hex: string): number => {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

const themes = THEME_IDS;
const palettes = Object.fromEntries(
	themes.map((id) => [id, palette(`[data-theme='${id}']`)])
) as Record<ThemeId, Palette>;

describe('theme palettes', () => {
	it('define every token for every theme, light themes first', () => {
		expect(Object.keys(palettes)).toEqual([
			'light',
			'paper',
			'parchment',
			'sepia',
			'frost',
			'lilac',
			'contrast',
			'dark',
			'graphite',
			'midnight',
			'candlelight',
			'horror',
			'cyberpunk',
			'terminal'
		]);
		expect(LIGHT_THEMES).toEqual(themes.slice(0, 7));
		expect(DARK_THEMES).toEqual(themes.slice(7));
	});

	it.each(themes)('%s: text is readable on every surface', (id) => {
		const p = palettes[id];
		for (const surface of [p.surface, p['surface-2'], p['surface-3']]) {
			expect(contrast(p.ink, surface)).toBeGreaterThanOrEqual(7);
			expect(contrast(p['ink-muted'], surface)).toBeGreaterThanOrEqual(4.5);
			expect(contrast(p.danger, surface)).toBeGreaterThanOrEqual(4.5);
		}
	});

	it.each(themes)('%s: the accent works as text and the accent fill as a button', (id) => {
		const p = palettes[id];
		expect(contrast(p.accent, p.surface)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(p.accent, p['surface-2'])).toBeGreaterThanOrEqual(4.5);
		expect(contrast(p['accent-ink'], p['accent-fill'])).toBeGreaterThanOrEqual(4.5);
	});

	it.each(themes)('%s: form outlines are visible (3:1)', (id) => {
		const p = palettes[id];
		expect(contrast(p['border-strong'], p.surface)).toBeGreaterThanOrEqual(3);
		expect(contrast(p['border-strong'], p['surface-2'])).toBeGreaterThanOrEqual(3);
	});

	it('high contrast also has strong hairlines', () => {
		const p = palettes.contrast;
		expect(contrast(p.border, p.surface)).toBeGreaterThanOrEqual(3);
		expect(contrast(p.ink, p.surface)).toBeGreaterThanOrEqual(21);
	});

	it('the system dark mode uses the Dark palette', () => {
		const system = declarations(':root:not([data-theme])');
		for (const token of TOKENS) expect(system[token]).toBe(palettes.dark[token]);
	});

	it.each(themes)('%s: the scheme matches the colours, the CSS and the theme-color', (id) => {
		const dark = luminance(palettes[id].surface) < 0.2;
		expect(THEMES[id].scheme).toBe(dark ? 'dark' : 'light');
		expect(DARK_THEMES.includes(id)).toBe(dark);
		expect(rule(`[data-theme='${id}']`)).toMatch(
			new RegExp(`color-scheme:\\s*${THEMES[id].scheme};`)
		);
		expect(THEMES[id].color).toBe(palettes[id].surface);
	});

	it('the dark: utilities follow exactly the dark themes', () => {
		const variant = /@custom-variant dark \{[\s\S]*?\n\}/.exec(css)?.[0] ?? '';
		const listed = new Set([...variant.matchAll(/\[data-theme='([\w-]+)'\]/g)].map((m) => m[1]));
		expect([...listed].sort()).toEqual([...DARK_THEMES].sort());
	});

	it('every bundled heading font is imported, so it works offline', () => {
		const bundled: Record<string, string> = {
			Cinzel: 'cinzel',
			"'Special Elite'": 'special-elite',
			Orbitron: 'orbitron'
		};
		for (const id of themes) {
			const font = declarations(`[data-theme='${id}']`)['font-display'];
			if (!font) continue;
			const first = font.split(',')[0].trim();
			if (bundled[first]) expect(css).toContain(`@import '@fontsource/${bundled[first]}/`);
		}
	});
});

describe('theme ids outside the stylesheet', () => {
	it('the first-paint script in index.html accepts exactly the theme ids', () => {
		const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
		const ids = /\/\^\(([\w|-]+)\)\$\//.exec(html)?.[1].split('|') ?? [];
		expect([...ids].sort()).toEqual([...themes].sort());
	});

	it('solid accent backgrounds with accent-ink text use the accent fill', () => {
		const ui = new URL('../ui/', import.meta.url);
		const files = readdirSync(ui, { recursive: true, encoding: 'utf8' }).filter((f) =>
			f.endsWith('.svelte')
		);
		const wrong = files.flatMap((f) =>
			[...readFileSync(new URL(f, ui), 'utf8').matchAll(/class="([^"]*)"/g)]
				.map((m) => m[1].split(/\s+/))
				.filter((classes) => classes.some((c) => /(^|:)text-accent-ink$/.test(c)))
				.filter((classes) => classes.some((c) => /(^|:)bg-accent$/.test(c)))
				.map((classes) => `${f}: ${classes.join(' ')}`)
		);
		expect(wrong).toEqual([]);
	});
});

describe('parseTheme', () => {
	it('keeps known themes and falls back to the system', () => {
		for (const id of themes) expect(parseTheme(id)).toBe(id);
		expect(parseTheme('system')).toBe('system');
		expect(THEME_CHOICES[0]).toBe('system');
		expect(parseTheme('neon')).toBe('system');
		expect(parseTheme('Horror')).toBe('system');
		expect(parseTheme(undefined)).toBe('system');
		expect(parseTheme(3)).toBe('system');
	});
});
