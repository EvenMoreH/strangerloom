// The generic adapter shows the abstract profile as it is. It is the fallback for every preset.
import {
	COMPETENCIES,
	COMPETENCY_WORDS,
	FANTASY_ANCHORS,
	RIDERS,
	type Attack,
	type DamageAnchors,
	type Npc,
	type Profile
} from '../schema';
import { GENERIC_CONDITIONS } from '../tracker';
import { cap, words } from './formula';
import type { StatBlock, StatLine, StatSection } from './types';

export const GENERIC_ADAPTER_ID = 'generic';
export const GENERIC_ADAPTER_VERSION = 1;

export function dots(rating: number, max = 5): string {
	return '●'.repeat(rating) + '○'.repeat(Math.max(0, max - rating));
}

const USE_LABEL: Record<Profile['abilities'][number]['use'], string> = {
	passive: 'passive',
	'at-will': 'at will',
	'per-fight': 'once per fight',
	reaction: 'reaction'
};

const COINS_LABEL: Record<Profile['loot']['coins'], string> = {
	none: 'no coin',
	few: 'a few coins',
	modest: 'a modest purse',
	good: 'a good purse',
	rich: 'a rich purse'
};

export interface RenderOptions {
	/** What light, medium and heavy damage compare to in the setting. Default: dagger, sword, greataxe. */
	anchors?: DamageAnchors;
}

export const USE_GROUP: Record<Attack['use'], string> = {
	basic: 'At will',
	signature: 'Signature'
};

/**
 * A basic option: `Melee, close. Medium damage.` (the section legend says what medium is like). A signature option
 * carries its own comparison: `Area, near. Heavy damage, like a fireball on everyone caught in it, fire.`
 */
export function attackText(a: Attack, anchors: DamageAnchors = FANTASY_ANCHORS): string {
	const type = a.damageType ? `, ${a.damageType}` : '';
	if (a.use === 'basic') return `${cap(a.kind)}, ${a.range}. ${cap(a.damage)} damage${type}.`;
	const who = a.kind === 'area' ? ' on everyone caught in it' : '';
	return `${cap(a.kind)}, ${a.range}. ${cap(a.damage)} damage, like ${a.anchor ?? anchors[a.damage]}${who}${type}.`;
}

/** The legend under the Attacks heading: `Light damage is like a dagger, medium like a sword, heavy like a greataxe.` */
export function damageLegend(anchors: DamageAnchors = FANTASY_ANCHORS): string {
	return `Light damage is like ${anchors.light}, medium like ${anchors.medium}, heavy like ${anchors.heavy}.`;
}

/** The rider's meaning and the trigger: `Knocks the target to the ground. Against a bloodied foe.` */
export function attackNote(a: Attack): string | undefined {
	const parts = [
		a.rider ? RIDERS[a.rider] : undefined,
		a.trigger ? `${cap(a.trigger)}.` : undefined
	];
	const text = parts.filter((x): x is string => !!x).join(' ');
	return text || undefined;
}

export function attackLine(a: Attack, i: number, anchors?: DamageAnchors): StatLine {
	return {
		id: `attack-${i}`,
		label: a.name,
		value: attackText(a, anchors),
		note: attackNote(a),
		group: USE_GROUP[a.use],
		attack: { kind: a.kind, range: a.range, ...(a.damageType ? { damageType: a.damageType } : {}) }
	};
}

export function renderGeneric(npc: Npc, options: RenderOptions = {}): StatBlock {
	const p = npc.profile;
	if (!p) throw new Error('The NPC has no profile to render.');
	const sections: StatSection[] = [];

	sections.push({
		id: 'header',
		label: 'Profile',
		lines: [
			{ id: 'archetype', label: 'Archetype', value: p.archetypeLabel },
			{ id: 'threat', label: 'Threat', value: `${cap(p.threat)}, power ${p.power}` },
			{ id: 'role', label: 'Role', value: cap(p.role) },
			{ id: 'defence', label: 'Defence', value: words(p.defence) },
			...(p.tags.length ? [{ id: 'tags', label: 'Tags', value: p.tags.map(words).join(', ') }] : [])
		]
	});

	sections.push({
		id: 'competencies',
		label: 'Competencies',
		lines: COMPETENCIES.map((k) => ({
			id: k,
			label: cap(k),
			value: dots(p.competencies[k]),
			note: COMPETENCY_WORDS[p.competencies[k]]
		}))
	});

	sections.push({
		id: 'offence',
		label: 'Attacks',
		note: damageLegend(options.anchors),
		lines: p.attacks.map((a, i) => attackLine(a, i, options.anchors))
	});

	sections.push({
		id: 'abilities',
		label: 'Abilities',
		lines: p.abilities.map((a) => ({
			id: a.id,
			label: a.name,
			value: USE_LABEL[a.use],
			note: a.text
		}))
	});

	sections.push({
		id: 'gear',
		label: 'Gear and loot',
		lines: [
			{ id: 'gear', label: 'Gear', value: p.gear.join(', ') },
			{
				id: 'loot',
				label: 'Loot',
				value: [COINS_LABEL[p.loot.coins], ...p.loot.items].join('; ')
			}
		]
	});

	sections.push({
		id: 'tactics',
		label: 'Tactics',
		lines: [{ id: 'tactics', value: cap(p.tactics) }]
	});

	return {
		adapter: GENERIC_ADAPTER_ID,
		adapterVersion: GENERIC_ADAPTER_VERSION,
		title: npc.narrative.name.full,
		subtitle: `${p.archetypeLabel} | ${cap(p.threat)} | power ${p.power}`,
		sections,
		tracker: { conditions: [...GENERIC_CONDITIONS] }
	};
}
