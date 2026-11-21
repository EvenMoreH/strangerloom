// Determinism: fixed seeds render to stored snapshots. A snapshot changes only when a pack version changes
// (tables, names, presets) or the renderer does. Fields are in their stored form (gender `f`, ancestry id), not the
// card's labels. Update with `npx vitest -u` and review the diff.
import { describe, expect, it } from 'vitest';
import { catalogFor, PRESETS } from '../content';
import { renderGeneric } from './adapter';
import { npcMarkdown, partyMarkdown } from './export';
import { fieldText } from './narrative';
import { generateNpc } from './npc';
import { generateParty, memberOrder } from './party';
import { newRecipe } from './recipe';
import type { Npc } from './schema';

const SEEDS = ['7KQ2M9XA', 'A1B2C3D4', 'Z9Y8X7W6'];
const text = (n: Npc) => ({
	text: (f: Parameters<typeof fieldText>[1]) => fieldText(n.narrative, f)
});
const snap = (name: string) => `__snapshots__/determinism/${name}.md`;

describe('determinism snapshots', () => {
	for (const preset of PRESETS.presets) {
		const catalog = catalogFor(preset.id);
		it(`${preset.id}: flavour NPCs`, async () => {
			const out = SEEDS.map((seed) => {
				const npc = generateNpc(newRecipe({ tier: 1, preset: preset.id, seed }), catalog).value;
				return npcMarkdown(npc, null, text(npc), { seed });
			});
			await expect(out.join('\n---\n\n')).toMatchFileSnapshot(snap(`${preset.id}-flavour`));
		});
		it(`${preset.id}: combat NPCs on the generic card`, async () => {
			const out = SEEDS.map((seed) => {
				const npc = generateNpc(newRecipe({ tier: 2, preset: preset.id, seed }), catalog).value;
				return npcMarkdown(npc, renderGeneric(npc), text(npc), { seed });
			});
			await expect(out.join('\n---\n\n')).toMatchFileSnapshot(snap(`${preset.id}-combat`));
		});
		it(`${preset.id}: parties`, async () => {
			const out = SEEDS.map((seed) => {
				const party = generateParty(newRecipe({ tier: 3, preset: preset.id, seed }), catalog).value;
				return partyMarkdown(party, {
					seed,
					member: (i) => text(party.members[i]),
					blocks: party.members.map((m) => renderGeneric(m)),
					order: memberOrder(party)
				});
			});
			await expect(out.join('\n---\n\n')).toMatchFileSnapshot(snap(`${preset.id}-party`));
		});
	}
});
