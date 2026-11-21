// In-memory search over saved records: every term of the query must appear somewhere in the record's text.
import { fieldText } from '../narrative';
import {
	NARRATIVE_FIELDS,
	type ChronicleEntry,
	type Npc,
	type SavedNpc,
	type SavedParty
} from '../schema';

const chronicleText = (entries: ChronicleEntry[] | undefined) =>
	(entries ?? []).flatMap((e) => [e.label, e.text]).filter(Boolean);

function npcText(npc: Npc): string {
	const parts = NARRATIVE_FIELDS.map((f) => fieldText(npc.narrative, f));
	const p = npc.profile;
	if (p) {
		parts.push(p.archetypeLabel, p.archetype, p.threat, p.role, ...p.tags);
		parts.push(...p.attacks.map((a) => a.name), ...p.abilities.map((a) => a.name), ...p.gear);
	}
	return parts.join('\n');
}

export function npcSearchText(r: SavedNpc): string {
	return [npcText(r.npc), ...r.tags, r.notes, ...chronicleText(r.chronicle)]
		.join('\n')
		.toLowerCase();
}

export function partySearchText(r: SavedParty): string {
	const p = r.party;
	return [
		p.name,
		p.reputation,
		p.goal,
		p.hook,
		p.tactics,
		p.loot.pool,
		p.loot.notable,
		...p.relationships.map((x) => x.text),
		...p.members.map(npcText),
		...r.tags,
		r.notes,
		...chronicleText(r.chronicle)
	]
		.join('\n')
		.toLowerCase();
}

/** True when every whitespace-separated term of `query` occurs in `haystack` (already lower-cased). */
export function matches(haystack: string, query: string): boolean {
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	return terms.every((t) => haystack.includes(t));
}
