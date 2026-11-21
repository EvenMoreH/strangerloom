// The colour themes a device can choose. The colours themselves are CSS tokens (`styles/app.css`, one block per
// theme); this file is the list of choices, their labels and schemes, and how a stored value is read.

export interface ThemeInfo {
	label: string;
	/** Light or dark: decides `color-scheme`, the `dark:` utilities and the group in the picker. */
	scheme: 'light' | 'dark';
	/** The page colour (`--surface`), used for the browser's theme-color. */
	color: string;
}

/** Every theme in picker order: the light themes, then the dark ones. */
export const THEMES = {
	light: { label: 'Light', scheme: 'light', color: '#fafaf9' },
	paper: { label: 'Paper', scheme: 'light', color: '#ffffff' },
	parchment: { label: 'Parchment', scheme: 'light', color: '#f8f1e3' },
	sepia: { label: 'Sepia', scheme: 'light', color: '#f5ead0' },
	frost: { label: 'Frost', scheme: 'light', color: '#f3f5f8' },
	lilac: { label: 'Lilac', scheme: 'light', color: '#f6f3fb' },
	contrast: { label: 'High contrast', scheme: 'light', color: '#ffffff' },
	dark: { label: 'Dark', scheme: 'dark', color: '#1c1917' },
	graphite: { label: 'Graphite', scheme: 'dark', color: '#111111' },
	midnight: { label: 'Midnight', scheme: 'dark', color: '#0f1623' },
	candlelight: { label: 'Candlelight', scheme: 'dark', color: '#15110d' },
	horror: { label: 'Horror', scheme: 'dark', color: '#111212' },
	cyberpunk: { label: 'Cyberpunk', scheme: 'dark', color: '#0b0a12' },
	terminal: { label: 'Terminal', scheme: 'dark', color: '#050b09' }
} as const satisfies Record<string, ThemeInfo>;

/** The themes that exist as CSS blocks. */
export type ThemeId = keyof typeof THEMES;
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

/** `system` sets no theme and lets the device decide between Light and Dark. */
export type ThemeChoice = 'system' | ThemeId;
export const THEME_CHOICES: readonly ThemeChoice[] = ['system', ...THEME_IDS];

/** Whether a value is one of the theme ids (not `system`). */
export function isThemeId(value: unknown): value is ThemeId {
	return THEME_IDS.some((id) => id === value);
}

/** A stored value as a choice; anything unknown is `system`. */
export function parseTheme(value: unknown): ThemeChoice {
	return THEME_CHOICES.find((choice) => choice === value) ?? 'system';
}

export const LIGHT_THEMES: readonly ThemeId[] = THEME_IDS.filter(
	(id) => THEMES[id].scheme === 'light'
);

/** The dark themes, which decide the `dark:` utilities and the browser's own controls. */
export const DARK_THEMES: readonly ThemeId[] = THEME_IDS.filter(
	(id) => THEMES[id].scheme === 'dark'
);
