// "Copy for TallyHo": a plain-text card in two parts. The first part is the person: the name, a summary line
// (ancestry, age, occupation) and one `Label: value` line per narrative field; it fills a wiki NPC entry. After a
// blank line comes the stat block, when the NPC has one; it fills the monster entry linked to the NPC. TallyHo's
// stat block parser recognises a name on the first line, one-line facts (`Challenge 2`, `Speed 30 ft.`,
// `Armor Class 15`, `Hit Points 31`, `Skills …`, `Key: value`), 5e-style attack lines under an "Actions" header,
// and named paragraphs (`Name. Text`). The stat block part is written in those shapes.
import type { StatBlock, StatLine } from '../adapter';
import type { Npc } from '../schema';
import { blurbOf } from './blurb';
import { narrativeRows, type TextOptions } from './text';

/** Labels the paste parser reads as a fact when followed by a space and the value. */
const FACTS = new Set([
	'Challenge',
	'Level',
	'Speed',
	'Saving Throws',
	'Skills',
	'Initiative',
	'Languages',
	'Senses',
	'Armor Class',
	'Hit Points',
	'Proficiency Bonus'
]);
/** Adapter labels (any case) that the parser knows under one spelling. */
const ALIASES: Record<string, string> = {
	ac: 'Armor Class',
	'armor class': 'Armor Class',
	'armour class': 'Armor Class',
	hp: 'Hit Points',
	'hit points': 'Hit Points',
	'saving throws': 'Saving Throws',
	saves: 'Saving Throws',
	challenge: 'Challenge',
	cr: 'Challenge',
	level: 'Level',
	speed: 'Speed',
	move: 'Speed',
	movement: 'Speed',
	initiative: 'Initiative',
	languages: 'Languages',
	senses: 'Senses'
};
const DICE = /^\d*d\d+(?:[+-]\d+)?$/i;
const KEY_VALUE_MAX = 40;

function cap(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A labelled value in the shape the parser reads: a fact line, `Key: value`, or a named paragraph. */
function factLine(label: string, value: string, note?: string): string {
	const lower = label.toLowerCase();
	const key = ALIASES[lower] ?? label;
	const bare = key === 'Challenge' ? value.replace(/^CR\s+/i, '') : value;
	const text = note ? `${bare} (${note})` : bare;
	// A key with a digit ("THAC0") is not read as a key; it goes into the value instead.
	if (/\d/.test(key)) return `To hit: ${key} ${text}`;
	if (FACTS.has(key)) return `${key} ${text}`;
	if (text.length <= KEY_VALUE_MAX && !text.includes(':')) return `${key}: ${text}`;
	return `${key}. ${text}`;
}

function attackLine(l: StatLine): string {
	const name = l.label ?? 'Attack';
	const a = l.attack;
	const note = l.note ? ` ${l.note}` : '';
	if (a?.damage && DICE.test(a.damage)) {
		const type = a.damageType && a.damageType !== 'physical' ? ` ${a.damageType}` : '';
		if (a.toHit && /^\+\d+$/.test(a.toHit) && a.kind !== 'area') {
			const kind = a.kind === 'ranged' ? 'Ranged' : 'Melee';
			return `${name}. ${kind} Weapon Attack: ${a.toHit} to hit, ${a.range}. Hit: ${a.damage}${type} damage.${note}`;
		}
		return `${name}. ${a.damage}${type} damage, ${a.range}.${note}`;
	}
	return `${name}. ${l.value}${note}`;
}

/** Skills as "Athletics +5, Arcana +3": per system skill when the adapter lists them, else the rating word. */
function skillsLine(lines: StatLine[]): string {
	const parts = lines.map((l) => {
		const numeric = /^[+-]?\d/.test(l.value);
		if (numeric && l.note) {
			return l.note
				.split(', ')
				.map((s) => `${s} ${l.value}`)
				.join(', ');
		}
		return `${l.label ?? l.id} ${numeric ? l.value : (l.note ?? l.value)}`;
	});
	return `Skills ${parts.join(', ')}`;
}

export function tallyhoText(npc: Npc, block: StatBlock | null, o: TextOptions): string {
	const n = npc.narrative;
	const out: string[] = [n.name.full];
	const summary = blurbOf(n, o);
	if (summary) out.push(summary);
	for (const [label, text] of narrativeRows(o)) {
		if (text) out.push(`${label}: ${text}`);
	}
	if (block) {
		out.push('');
		const by = (id: string) => block.sections.find((s) => s.id === id);
		for (const id of ['header', 'defence']) {
			for (const l of by(id)?.lines ?? []) {
				if (l.id === 'archetype' || l.id === 'threat' || l.id === 'role' || l.id === 'tags')
					continue;
				out.push(factLine(l.label ?? cap(l.id), l.value, l.note));
			}
		}
		const header = by('header');
		const type = header?.lines.filter(
			(l) => l.id === 'archetype' || l.id === 'threat' || l.id === 'role'
		);
		if (type?.length) out.push(`Type: ${type.map((l) => l.value).join(', ')}`);
		const tags = header?.lines.find((l) => l.id === 'tags');
		if (tags) out.push(`Tags: ${tags.value}`);
		const comp = by('competencies');
		if (comp?.lines.length) out.push(skillsLine(comp.lines));
		for (const s of block.sections) {
			if (
				['header', 'defence', 'competencies', 'offence', 'abilities', 'gear', 'tactics'].includes(
					s.id
				)
			) {
				continue;
			}
			for (const l of s.lines) out.push(factLine(l.label ?? cap(l.id), l.value, l.note));
		}
		const offence = by('offence');
		if (offence?.lines.length) {
			out.push('Actions');
			for (const l of offence.lines) out.push(attackLine(l));
		}
		const abilities = by('abilities');
		if (abilities?.lines.length) {
			out.push('Traits');
			// "Mend. At will: heals an ally." The use goes into the text, so the name stays short enough to be read as one.
			for (const l of abilities.lines) {
				out.push(`${l.label ?? cap(l.id)}. ${cap(l.value)}: ${l.note ?? ''}`.trim());
			}
		}
		for (const l of by('gear')?.lines ?? []) out.push(`${l.label ?? cap(l.id)}. ${l.value}`);
		for (const l of by('tactics')?.lines ?? []) out.push(`Tactics. ${l.value}`);
	}
	return out.join('\n') + '\n';
}
