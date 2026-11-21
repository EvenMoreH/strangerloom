// Display helpers shared by the NPC card and the party member cards.
import { blurbOf, BLURB_TABLES, NARRATIVE_LABELS, type TextOptions } from '../../engine/export';
import { packs } from '../../data/packs.svelte';
import { PRESETS } from '../../content';
import { cap, type StatBlock } from '../../engine/adapter';
import { fieldText } from '../../engine/narrative';
import type { Narrative, NarrativeField, Npc, Shape } from '../../engine/schema';

/** The narrative rows of a card, in order, with their labels. */
export const NARRATIVE_ROWS = NARRATIVE_LABELS;

const GENDER_LABEL: Record<string, string> = { f: 'feminine', m: 'masculine', n: 'neutral' };

/** The ancestry with its culture, framed the way the preset asks (`cultureFrame`): "Human, Polish" by default,
 *  "Dwarf of Chinese heritage" with the frame "of {culture} heritage". */
export function ancestryText(narrative: Narrative, presetId?: string): string {
	const label = PRESETS.ancestries[narrative.ancestry]?.label ?? narrative.ancestry;
	if (!narrative.culture) return label;
	const culture = PRESETS.cultures[narrative.culture]?.label ?? narrative.culture;
	const frame = PRESETS.presets.find((p) => p.id === presetId)?.cultureFrame;
	return frame ? `${label} ${frame.replaceAll('{culture}', culture)}` : `${label}, ${culture}`;
}

/** The text a card shows for a narrative field. The preset frames the culture (see `ancestryText`). */
export function displayField(
	narrative: Narrative,
	field: NarrativeField,
	presetId?: string
): string {
	if (field === 'ancestry') return ancestryText(narrative, presetId);
	if (field === 'gender') return GENDER_LABEL[narrative.gender] ?? narrative.gender;
	if (field === 'age') return `${narrative.age.stage}, ${narrative.age.years} years`;
	return fieldText(narrative, field);
}

/** The shape of the table behind a blurb field, from the packs in use. */
export function shapeOf(field: NarrativeField): Shape | undefined {
	const table = BLURB_TABLES[field];
	return table ? packs.tableShape(table) : undefined;
}

/** Text callbacks for the blurb and the exports: display labels, hidden fields left out, table shapes. */
export function textOptionsOf(
	narrative: Narrative,
	hidden: (f: NarrativeField) => boolean,
	presetId?: string
): TextOptions {
	return { text: (f) => displayField(narrative, f, presetId), hidden, shape: shapeOf };
}

/** The blurb under a name: ancestry, age, occupation, look and quirk in a sentence, attitude and mood in a second
 *  one, leaving out hidden fields. */
export function blurbLine(
	narrative: Narrative,
	hidden: (f: NarrativeField) => boolean,
	presetId?: string
): string {
	return blurbOf(narrative, textOptionsOf(narrative, hidden, presetId));
}

/** The combat summary of a member row: archetype, threat and power. Empty for a flavour NPC. */
export function profileLine(npc: Npc): string {
	const p = npc.profile;
	return p ? `${p.archetypeLabel} | ${cap(p.threat)} | power ${p.power}` : '';
}

/** "Copy blurb": the name (with the Leader tag), the combat summary and the blurb, one per line. */
export function blurbText(
	npc: Npc,
	hidden: (f: NarrativeField) => boolean,
	presetId: string | undefined,
	leader = false
): string {
	return [
		leader ? `${npc.narrative.name.full} | Leader` : npc.narrative.name.full,
		profileLine(npc),
		blurbLine(npc.narrative, hidden, presetId)
	]
		.filter(Boolean)
		.join('\n');
}

/** A stat block as plain text lines, for the clipboard. */
/** The "Copy as text" form of one NPC: name, the visible rows, the stat block sections. */
export function npcPlainText(
	narrative: Narrative,
	block: StatBlock | null,
	hidden: (f: NarrativeField) => boolean,
	presetId?: string
): string {
	const lines = NARRATIVE_ROWS.filter(([f]) => !hidden(f)).map(
		([field, label]) => `${label}: ${displayField(narrative, field, presetId)}`
	);
	const stat = block ? statBlockText(block) : [];
	return `${narrative.name.full}${hidden('pronouns') ? '' : ` (${narrative.pronouns})`}\n${lines.join('\n')}${stat.join('\n')}`;
}

export function statBlockText(block: StatBlock): string[] {
	return block.sections.flatMap((s) => [
		'',
		s.label + (s.note ? ' (' + s.note + ')' : ''),
		...s.lines.map(
			(l) =>
				`  ${l.label ? l.label + ': ' : ''}${l.value}${l.roll ? ' [' + l.roll + ']' : ''}${l.note ? ' (' + l.note + ')' : ''}`
		)
	]);
}
