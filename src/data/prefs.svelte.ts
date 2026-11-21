// Device preferences in localStorage under one key.
import {
	EMBED_THEME_KEY,
	embedThemeFromMessage,
	embedThemeFromSearch,
	isFollowing,
	offersFollow,
	shownTheme,
	type FollowState
} from '../engine/embed';
import { NARRATIVE_FIELDS, type NarrativeField } from '../engine/schema';
import { isThemeId, parseTheme, THEMES, type ThemeChoice, type ThemeId } from '../engine/themes';

const KEY = 'strangerloom.prefs';

/** Optional parts of the generate screen a GM can switch off. All on by default. */
export const FEATURES = {
	tracker: 'Hit point and condition tracker under the combat card',
	rollButtons: 'Roll buttons on dice strings (off: dice are shown as text)',
	shortcuts: 'Keyboard shortcuts (G, R, L) and the hint line',
	initiative: 'Initiative roller on the party card'
} as const;
export type Feature = keyof typeof FEATURES;
export const FEATURE_IDS = Object.keys(FEATURES) as Feature[];

export type ViewChoice = 'full' | 'compact';

export interface Prefs {
	theme: ThemeChoice;
	/** Narrative fields the result card does not show. Every field is shown until the GM hides it. */
	hiddenFields: NarrativeField[];
	features: Record<Feature, boolean>;
	/** The stat block view a combat NPC opens in. The Full/Compact switch on the screen is temporary. */
	defaultView: ViewChoice;
	/** The storage notice (data stays on this device, export a backup) has been dismissed. */
	storageNoticeSeen: boolean;
	/** Inside a frame, show the embedder's theme instead of `theme` ("Follow TallyHo"). Read only while framed. */
	followEmbed: boolean;
}

const ALL_ON = Object.fromEntries(FEATURE_IDS.map((f) => [f, true])) as Record<Feature, boolean>;
const DEFAULTS: Prefs = {
	theme: 'system',
	hiddenFields: [],
	features: { ...ALL_ON },
	defaultView: 'full',
	storageNoticeSeen: false,
	followEmbed: true
};

function parseHidden(value: unknown): NarrativeField[] {
	if (!Array.isArray(value)) return [];
	return NARRATIVE_FIELDS.filter((f) => value.includes(f));
}

function parseFeatures(value: unknown): Record<Feature, boolean> {
	const out = { ...ALL_ON };
	if (value && typeof value === 'object') {
		for (const f of FEATURE_IDS) {
			const v = (value as Record<string, unknown>)[f];
			if (typeof v === 'boolean') out[f] = v;
		}
	}
	return out;
}

function read(): Prefs {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, unknown>;
		return {
			theme: parseTheme(raw.theme),
			hiddenFields: parseHidden(raw.hiddenFields),
			features: parseFeatures(raw.features),
			defaultView: raw.defaultView === 'compact' ? 'compact' : 'full',
			storageNoticeSeen: raw.storageNoticeSeen === true,
			followEmbed: raw.followEmbed !== false
		};
	} catch {
		return { ...DEFAULTS, features: { ...ALL_ON } };
	}
}

function applyTheme(theme: ThemeChoice) {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	if (theme === 'system') root.removeAttribute('data-theme');
	else root.setAttribute('data-theme', theme);
	// Both theme-color tags (one per system scheme) take the chosen theme's page colour; "Match system" puts
	// Light and Dark back on them.
	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
		if (theme === 'system') {
			meta.content = meta.media?.includes('dark') ? THEMES.dark.color : THEMES.light.color;
		} else {
			meta.content = THEMES[theme].color;
		}
	}
	root.style.colorScheme = theme === 'system' ? '' : THEMES[theme].scheme;
}

const isFramed = (): boolean => typeof window !== 'undefined' && window.self !== window.top;

/** The embedder's theme kept for this tab, or null. Storage may be unavailable inside a frame. */
function readEmbedTheme(): ThemeId | null {
	try {
		const value = sessionStorage.getItem(EMBED_THEME_KEY);
		return isThemeId(value) ? value : null;
	} catch {
		return null;
	}
}

function keepEmbedTheme(id: ThemeId) {
	try {
		sessionStorage.setItem(EMBED_THEME_KEY, id);
	} catch {
		// The theme still applies for this page load.
	}
}

function createPrefs() {
	const initial = typeof localStorage === 'undefined' ? { ...DEFAULTS } : read();
	const framed = isFramed();
	let theme = $state<ThemeChoice>(initial.theme);
	let hiddenFields = $state<NarrativeField[]>(initial.hiddenFields);
	let features = $state<Record<Feature, boolean>>(initial.features);
	let defaultView = $state<ViewChoice>(initial.defaultView);
	let storageNoticeSeen = $state(initial.storageNoticeSeen);
	let followEmbed = $state(initial.followEmbed);
	// Same order as the first-paint script: the address first, then what this tab kept.
	const sent = framed ? embedThemeFromSearch(location.search) : null;
	if (sent) keepEmbedTheme(sent);
	let embedTheme = $state<ThemeId | null>(framed ? (sent ?? readEmbedTheme()) : null);
	const follow = (): FollowState => ({ framed, follow: followEmbed, embedTheme });
	const show = () => applyTheme(shownTheme(follow(), theme));
	show();
	if (framed) {
		// The embedder posts its theme on every load of the frame and whenever it changes. Only the parent window
		// counts; anything else is ignored.
		window.addEventListener('message', (event) => {
			try {
				if (event.source !== window.parent) return;
				const id = embedThemeFromMessage(event.data);
				if (!id) return;
				embedTheme = id;
				keepEmbedTheme(id);
				show();
			} catch {
				// Not a message for this app.
			}
		});
	}
	function save() {
		localStorage.setItem(
			KEY,
			JSON.stringify({ theme, hiddenFields, features, defaultView, storageNoticeSeen, followEmbed })
		);
	}
	return {
		/** The app's own saved choice. While following, the page shows the embedder's theme instead. */
		get theme() {
			return theme;
		},
		/** Picks a theme of the app's own; inside a frame this also stops following the embedder. */
		setTheme(next: ThemeChoice) {
			theme = next;
			if (framed) followEmbed = false;
			show();
			save();
		},
		/** The last theme the embedder sent, inside a frame. */
		get embedTheme() {
			return embedTheme;
		},
		/** The picker offers "Follow TallyHo". */
		get offersFollow() {
			return offersFollow(follow());
		},
		/** The page shows the embedder's theme. */
		get following() {
			return isFollowing(follow());
		},
		/** Turns following back on and shows the last theme the embedder sent. */
		followEmbedder() {
			followEmbed = true;
			show();
			save();
		},
		get hiddenFields() {
			return hiddenFields;
		},
		isHidden(field: NarrativeField) {
			return hiddenFields.includes(field);
		},
		setFieldHidden(field: NarrativeField, hidden: boolean) {
			hiddenFields = hidden
				? [...new Set([...hiddenFields, field])]
				: hiddenFields.filter((f) => f !== field);
			save();
		},
		showAllFields() {
			hiddenFields = [];
			save();
		},
		get features() {
			return features;
		},
		has(feature: Feature) {
			return features[feature];
		},
		setFeature(feature: Feature, on: boolean) {
			features = { ...features, [feature]: on };
			save();
		},
		get defaultView() {
			return defaultView;
		},
		setDefaultView(view: ViewChoice) {
			defaultView = view;
			save();
		},
		get storageNoticeSeen() {
			return storageNoticeSeen;
		},
		dismissStorageNotice() {
			storageNoticeSeen = true;
			save();
		}
	};
}

export const prefs = createPrefs();
