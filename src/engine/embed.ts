// Theme following inside an embedding page (TallyHo's embed tab). The embedder puts its shown theme in the frame
// address as `?embed-theme=<id>` and posts `{ type: 'embed-theme', theme: '<id>' }` to the frame whenever it
// changes. Inside a frame the app shows that theme while following is on; its own saved theme stays as it is.
// The first-paint script in index.html applies the same rule before the app starts.
import { isThemeId, type ThemeChoice, type ThemeId } from './themes';

/** The query parameter of the frame address. */
export const EMBED_THEME_PARAM = 'embed-theme';
/** The message type the embedder posts. */
export const EMBED_THEME_MESSAGE = 'embed-theme';
/** The sessionStorage key of the last theme the embedder sent; it outlives full page loads inside the frame. */
export const EMBED_THEME_KEY = 'strangerloom.embedTheme';

/** The theme in a `location.search` string, or null when it is missing or not a theme id. */
export function embedThemeFromSearch(search: string): ThemeId | null {
	const value = new URLSearchParams(search).get(EMBED_THEME_PARAM);
	return isThemeId(value) ? value : null;
}

/** `location.search` without the embed parameter, for links that leave the frame. */
export function withoutEmbedTheme(search: string): string {
	const params = new URLSearchParams(search);
	params.delete(EMBED_THEME_PARAM);
	const rest = params.toString();
	return rest ? `?${rest}` : '';
}

/** The theme of an embedder's message, or null for anything that is not a plain `embed-theme` message. */
export function embedThemeFromMessage(data: unknown): ThemeId | null {
	if (typeof data !== 'object' || data === null) return null;
	const proto: unknown = Object.getPrototypeOf(data);
	if (proto !== Object.prototype && proto !== null) return null;
	const { type, theme } = data as Record<string, unknown>;
	return type === EMBED_THEME_MESSAGE && isThemeId(theme) ? theme : null;
}

export interface FollowState {
	/** The app runs inside a frame. */
	framed: boolean;
	/** The device preference; it only counts inside a frame. */
	follow: boolean;
	/** The last theme the embedder sent, if any. */
	embedTheme: ThemeId | null;
}

/** Whether the shown theme is the embedder's: framed, following on and a theme received. */
export function isFollowing(state: FollowState): boolean {
	return state.framed && state.follow && state.embedTheme !== null;
}

/** The theme to show: the embedder's while following, otherwise the app's own choice. */
export function shownTheme(state: FollowState, own: ThemeChoice): ThemeChoice {
	return state.framed && state.follow && state.embedTheme ? state.embedTheme : own;
}

/** Whether the picker offers "Follow TallyHo": inside a frame, once the embedder has sent a theme. */
export function offersFollow(state: FollowState): boolean {
	return state.framed && state.embedTheme !== null;
}
