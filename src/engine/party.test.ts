import { describe, expect, it } from 'vitest';
import { catalogFor, PRESETS } from '../content';
import { generateNpc } from './npc';
import {
	explodeMemberLock,
	generateParty,
	standaloneMemberRecipe,
	memberKey,
	memberRecipe,
	memberSeed,
	promoteToParty,
	rerollPartyDistinct
} from './party';
import { lockField, newRecipe } from './recipe';
import { Party } from './schema';

const SEEDS = ['7KQ2M9XA', 'AAAAAAAA', 'ZZZZZZZZ', 'HE110123'];

describe('generateParty', () => {
	const catalog = catalogFor('high-fantasy');

	it('is deterministic, validates and has the requested size', () => {
		for (const size of [3, 4, 5, 6]) {
			const recipe = newRecipe({
				tier: 3,
				preset: 'high-fantasy',
				seed: '7KQ2M9XA',
				options: { partySize: size }
			});
			const a = generateParty(recipe, catalog).value;
			const b = generateParty(recipe, catalog).value;
			expect(a).toEqual(b);
			expect(Party.parse(a)).toEqual(a);
			expect(a.members).toHaveLength(size);
			expect(a.leaderIndex).toBeLessThan(size);
			for (const m of a.members) expect(m.tier).toBe(2);
			expect(a.name).not.toBe('');
			expect(a.name).not.toMatch(/[{}]/);
		}
	});

	it('members have distinct seeds and names', () => {
		const seeds = new Set([0, 1, 2, 3, 4, 5].map((i) => memberSeed('7KQ2M9XA', i)));
		expect(seeds.size).toBe(6);
		expect(memberSeed('7KQ2M9XA', 0, 1)).not.toBe(memberSeed('7KQ2M9XA', 0, 0));
		for (const seed of SEEDS) {
			const party = generateParty(
				newRecipe({ tier: 3, preset: 'high-fantasy', seed, options: { partySize: 6 } }),
				catalog
			).value;
			const names = new Set(party.members.map((m) => m.narrative.name.full));
			expect(names.size).toBe(6);
		}
	});

	it('balanced parties cover tank, healer, damage and utility; powers spread around the average', () => {
		for (const preset of PRESETS.presets) {
			const cat = catalogFor(preset.id);
			for (const seed of SEEDS) {
				const party = generateParty(
					newRecipe({ tier: 3, preset: preset.id, seed, options: { partySize: 4, power: 5 } }),
					cat
				).value;
				const roles = party.members.map((m) => m.profile!.role);
				expect(roles[0]).toBe('brute');
				expect(roles[1]).toBe('support');
				expect(['skirmisher', 'sniper']).toContain(roles[2]);
				expect(['controller', 'leader']).toContain(roles[3]);
				for (const m of party.members) {
					expect(m.profile!.power).toBeGreaterThanOrEqual(4);
					expect(m.profile!.power).toBeLessThanOrEqual(6);
				}
			}
		}
	});

	it('relationships connect every member and name them', () => {
		for (const seed of SEEDS) {
			const party = generateParty(
				newRecipe({ tier: 3, preset: 'sci-fi', seed, options: { partySize: 5 } }),
				catalogFor('sci-fi')
			).value;
			expect(party.relationships.length).toBeGreaterThanOrEqual(4);
			const touched = new Set(party.relationships.flatMap((r) => [r.a, r.b]));
			expect(touched.size).toBe(5);
			for (const r of party.relationships) {
				expect(r.a).not.toBe(r.b);
				expect(r.text).not.toMatch(/\[a\]|\[b\]/);
				expect(r.text).toContain(party.members[r.a].narrative.name.given);
				expect(r.text).toContain(party.members[r.b].narrative.name.given);
			}
		}
	});

	it('the leader is a member with the leader role when there is one', () => {
		for (const seed of SEEDS) {
			const party = generateParty(
				newRecipe({ tier: 3, preset: 'high-fantasy', seed, options: { partySize: 6 } }),
				catalog
			).value;
			const leaders = party.members.flatMap((m, i) => (m.profile!.role === 'leader' ? [i] : []));
			if (leaders.length) expect(leaders).toContain(party.leaderIndex);
		}
	});

	it('rerolls one party field without moving the others; rerolls one member alone', () => {
		const recipe = newRecipe({ tier: 3, preset: 'high-fantasy', seed: '7KQ2M9XA' });
		const base = generateParty(recipe, catalog).value;
		const goal = rerollPartyDistinct(recipe, { field: 'goal' }, base, catalog);
		expect(goal.value.goal).not.toBe(base.goal);
		expect({ ...goal.value, goal: '' }).toEqual({ ...base, goal: '' });

		const member = rerollPartyDistinct(recipe, { member: 1 }, base, catalog);
		expect(member.value.members[1]).not.toEqual(base.members[1]);
		expect(member.value.members[0]).toEqual(base.members[0]);
		expect(member.value.members[2]).toEqual(base.members[2]);
		expect(member.recipe.nonces[memberKey(1)]).toBe(1);

		const quirk = rerollPartyDistinct(recipe, { member: 2, field: 'quirk' }, base, catalog);
		expect(quirk.value.members[2].narrative.quirk).not.toBe(base.members[2].narrative.quirk);
		expect({ ...quirk.value.members[2].narrative, quirk: '' }).toEqual({
			...base.members[2].narrative,
			quirk: ''
		});
		expect(generateParty(quirk.recipe, catalog).value).toEqual(quirk.value);
	});

	it('a locked member survives a new seed; a member archetype lock is the member option', () => {
		const recipe = newRecipe({ tier: 3, preset: 'high-fantasy', seed: '7KQ2M9XA' });
		const base = generateParty(recipe, catalog).value;
		const locked = lockField(recipe, memberKey(2), base.members[2]);
		const other = generateParty({ ...locked, seed: 'ZZZZZZZZ' }, catalog).value;
		expect(other.members[2]).toEqual(base.members[2]);
		expect(other.members[0]).not.toEqual(base.members[0]);

		const sub = memberRecipe(lockField(recipe, 'm1.archetype', 'mage'), 1, {
			power: 5,
			archetype: 'brute'
		});
		expect(sub.options.archetype).toBe('mage');
		expect(sub.locks.archetype).toBeUndefined();
		expect(sub.tier).toBe(2);
	});

	it('promotion to a party keeps the combat NPC as member 0', () => {
		const t2 = newRecipe({ tier: 2, preset: 'modern', seed: '7KQ2M9XA' });
		const npc = generateNpc(t2, catalogFor('modern')).value;
		const party = generateParty(promoteToParty(t2, npc), catalogFor('modern')).value;
		expect(party.members[0]).toEqual(npc);
		expect(party.members).toHaveLength(4);
	});

	it('a whole-member lock explodes into field locks that keep the member and free one field', () => {
		for (const preset of PRESETS.presets) {
			const cat = catalogFor(preset.id);
			const t2 = newRecipe({ tier: 2, preset: preset.id, seed: 'HE110123', options: { power: 8 } });
			const npc = generateNpc(t2, cat).value;
			const recipe = promoteToParty(t2, npc);
			const party = generateParty(recipe, cat).value;
			const exploded = explodeMemberLock(recipe, party, 0);
			expect(exploded.locks.m0).toBeUndefined();
			expect(exploded.locks['m0.power']).toBe(npc.profile!.power);
			const again = generateParty(exploded, cat).value;
			expect(again.members[0]).toEqual(npc);

			const quirk = rerollPartyDistinct(exploded, { member: 0, field: 'quirk' }, again, cat);
			expect(quirk.value.members[0].narrative.quirk).not.toBe(npc.narrative.quirk);
			expect({ ...quirk.value.members[0].narrative, quirk: '' }).toEqual({
				...npc.narrative,
				quirk: ''
			});
			expect(quirk.value.members[0].profile).toEqual(npc.profile);
		}
	});

	it('a standalone member recipe regenerates the same NPC on its own, also for a locked member', () => {
		for (const preset of PRESETS.presets) {
			const cat = catalogFor(preset.id);
			const recipe = newRecipe({
				tier: 3,
				preset: preset.id,
				seed: 'HE110123',
				options: { power: 6 }
			});
			const party = generateParty(recipe, cat).value;
			for (let i = 0; i < party.members.length; i++) {
				const alone = standaloneMemberRecipe(recipe, party, i);
				expect(alone.tier).toBe(2);
				expect(generateNpc(alone, cat).value).toEqual(party.members[i]);
			}
			const t2 = newRecipe({ tier: 2, preset: preset.id, seed: 'ZZZZZZZZ', options: { power: 9 } });
			const npc = generateNpc(t2, cat).value;
			const promoted = promoteToParty(t2, npc);
			const around = generateParty(promoted, cat).value;
			expect(generateNpc(standaloneMemberRecipe(promoted, around, 0), cat).value).toEqual(npc);
		}
	});

	it('rerolling the leader hands the lead to another member', () => {
		const recipe = newRecipe({ tier: 3, preset: 'high-fantasy', seed: '7KQ2M9XA' });
		const base = generateParty(recipe, catalog).value;
		const out = rerollPartyDistinct(recipe, { field: 'leader' }, base, catalog);
		expect(out.value.leaderIndex).not.toBe(base.leaderIndex);
		expect(out.value.members).toEqual(base.members);
	});

	it('loot pools follow the power band', () => {
		const at = (power: number) =>
			generateParty(
				newRecipe({ tier: 3, preset: 'high-fantasy', seed: 'AAAAAAAA', options: { power } }),
				catalog
			).value.loot.pool;
		expect(at(1)).not.toBe(at(10));
	});
});
