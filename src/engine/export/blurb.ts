// The blurb: one or two sentences about an NPC built from eight rolled fields, for the line under the name, list
// rows and the exports. Table shapes (schema `Table.shape`) choose the connectives, so customised tables still read.
import type { Narrative, NarrativeField, Shape } from '../schema';
import type { TextOptions } from './text';

/** The fields a blurb uses and the tables whose shape governs them. */
export const BLURB_TABLES: Partial<Record<NarrativeField, string>> = {
	occupation: 'occupation',
	visual: 'visual',
	quirk: 'quirk',
	attitude: 'attitude',
	mood: 'mood'
};

/** The shape each blurb slot is written for; a table without a shape is read this way. */
const DEFAULT_SHAPE: Record<string, Shape> = {
	occupation: 'noun',
	visual: 'noun',
	quirk: 'verb',
	attitude: 'adjective',
	mood: 'adjective'
};

/** "a" or "an" for a word, by its sound rather than its first letter where the two differ. */
export function article(phrase: string): 'a' | 'an' {
	const w = phrase.trim().toLowerCase();
	if (/^(hour|honest|honou?r|heir)/.test(w)) return 'an';
	if (/^(uni[a-z]|use|usu|usa|eu|one|ou[ij]|ub[iq]|ut[eo])/.test(w)) return 'a';
	return /^[aeiou]/.test(w) ? 'an' : 'a';
}

/** Looks that are carried: "carrying a lute with one string missing". */
const CARRIED =
	/\b(lute|lyre|fiddle|drum|phone|slate|duffel|bag|backpack|satchel|sack|case|book|ledger|sword|blade|knife|dagger|cane|staff|basket|lantern|pack|box|tray|bottle|flask|parcel)\b/i;
/** Looks that are worn: "wearing a scarf covering the lower face". */
const WORN =
	/\b(hat|cap|hood|hoodie|coat|cloak|jacket|tabard|apron|sash|scarf|shawl|ribbon|gloves?|boots?|shoes?|belt|spectacles|glasses|goggles|pendant|band|ring|chain|cord|thong|lanyard|badge|pin|brooch|wristband|earpiece|headphones|respirator|helm|helmet|wreath|necklace|bracelet|amulet|mask|armou?r|vest|robe|tunic|dress|shirt|bandage|wrist|neck|collar)\b/i;

/**
 * The word before a look: "wearing" for a garment or an accessory, "carrying" for a thing in hand, "with" for a
 * body feature ("an eye that glows faintly blue") and for a look that already says worn or carried.
 */
export function lookJoin(look: string): 'with' | 'wearing' | 'carrying' {
	if (/\b(worn|wearing|carried|carrying)\b/i.test(look)) return 'with';
	if (CARRIED.test(look)) return 'carrying';
	if (WORN.test(look)) return 'wearing';
	return /\bwith\b/i.test(look) ? 'wearing' : 'with';
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const low = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const sentence = (s: string) => {
	const t = s.trim().replace(/\s+/g, ' ');
	return /[.!?]$/.test(t) ? cap(t) : cap(t) + '.';
};

/**
 * The blurb of an NPC, for the line under the name: "Human, 48, a grave-warden with a lute missing a string who has
 * a tremor in one hand. Friendly towards people, amused at the moment." The name is not in it, since the blurb always
 * sits under the name. Hidden fields drop out with their connectives; every field hidden gives an empty string. An
 * entry whose shape does not fit its slot becomes a short sentence of its own, with the given name as its subject.
 */
export function blurbOf(n: Narrative, o: TextOptions): string {
	const hidden = (f: NarrativeField) => o.hidden?.(f) ?? false;
	const shape = (f: NarrativeField): Shape => o.shape?.(f) ?? DEFAULT_SHAPE[f] ?? 'sentence';
	const text = (f: NarrativeField) => (hidden(f) ? '' : o.text(f).trim());
	const given = n.name.given || n.name.full;
	const extra: string[] = [];
	/** A value whose shape does not fit where the sentence needs it, as a sentence of its own. */
	const aside = (value: string, s: Shape) => {
		if (s === 'sentence') extra.push(sentence(value));
		else if (s === 'verb') extra.push(sentence(`${given} ${value}`));
		else if (s === 'noun') extra.push(sentence(`${given} has ${value}`));
		else extra.push(sentence(`${given} is ${value}`));
	};

	const head = [text('ancestry'), hidden('age') ? '' : String(n.age.years)].filter(Boolean);
	const parts: string[] = [];
	let afterOccupation = false;
	let predicate = false;

	const occupation = text('occupation');
	if (occupation) {
		const s = shape('occupation');
		if (s === 'noun') {
			parts.push(`${article(occupation)} ${low(occupation)}`);
			afterOccupation = true;
		} else if (s === 'adjective') parts.push(occupation);
		else if (s === 'verb') parts.push(occupation);
		else aside(occupation, s);
		predicate = parts.length > 0;
	}
	for (const f of ['visual', 'quirk'] as const) {
		const value = text(f);
		if (!value) continue;
		const s = shape(f);
		if (s === 'sentence') {
			aside(value, s);
			continue;
		}
		let clause: string;
		if (s === 'noun')
			clause = predicate ? `${f === 'visual' ? lookJoin(value) : 'with'} ${value}` : `has ${value}`;
		else if (s === 'verb')
			clause = predicate ? `${afterOccupation ? 'who' : 'and'} ${value}` : value;
		else clause = predicate ? `and is ${value}` : `is ${value}`;
		parts.push(clause);
		predicate = true;
		if (s !== 'noun') afterOccupation = false;
	}

	const out: string[] = [];
	if (head.length || parts.length) {
		out.push(sentence([...head, parts.join(' ')].filter(Boolean).join(', ')));
	}
	out.push(...extra.splice(0));

	const second: string[] = [];
	const attitude = text('attitude');
	if (attitude) {
		if (shape('attitude') === 'adjective') second.push(`${attitude} towards people`);
		else aside(attitude, shape('attitude'));
	}
	const mood = text('mood');
	if (mood) {
		if (shape('mood') === 'adjective') second.push(`${mood} at the moment`);
		else aside(mood, shape('mood'));
	}
	if (second.length) out.push(sentence(second.join(', ')));
	out.push(...extra);
	return out.join(' ');
}
