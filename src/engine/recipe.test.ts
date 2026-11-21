import { describe, expect, it } from 'vitest';
import {
	decodeShare,
	encodeShare,
	isLocked,
	lockField,
	newRecipe,
	rerollAll,
	rerollField,
	unlockField,
	withPacks
} from './recipe';

describe('recipe operations', () => {
	const base = newRecipe({ tier: 1, preset: 'high-fantasy', seed: '7KQ2M9XA' });

	it('newRecipe fills defaults', () => {
		expect(base.options).toEqual({
			ancestry: 'any',
			gender: 'any',
			culture: 'any',
			archetype: 'any',
			power: 5,
			threat: 'auto',
			partySize: 4
		});
		expect(base.filters).toEqual({ ancestries: [], archetypes: [], tone: [] });
		expect(base.nonces).toEqual({});
		expect(newRecipe({ tier: 2, preset: 'modern' }).seed).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
	});

	it('rerollField bumps one nonce and unlocks that field', () => {
		const locked = lockField(base, 'name', { full: 'X' });
		const r = rerollField(rerollField(locked, 'name'), 'quirk');
		expect(r.nonces).toEqual({ name: 1, quirk: 1 });
		expect(isLocked(r, 'name')).toBe(false);
		expect(rerollField(r, 'name').nonces.name).toBe(2);
		expect(base.nonces).toEqual({});
	});

	it('lock and unlock keep the value', () => {
		const r = lockField(base, 'occupation', 'Ferrier');
		expect(isLocked(r, 'occupation')).toBe(true);
		expect(r.locks.occupation).toBe('Ferrier');
		expect(isLocked(unlockField(r, 'occupation'), 'occupation')).toBe(false);
	});

	it('rerollAll changes the seed, clears nonces and keeps locks', () => {
		const r = rerollAll(lockField(rerollField(base, 'name'), 'quirk', 'q'), 'AAAAAAAA');
		expect(r.seed).toBe('AAAAAAAA');
		expect(r.nonces).toEqual({});
		expect(r.locks).toEqual({ quirk: 'q' });
	});

	it('withPacks records versions', () => {
		expect(withPacks(base, { core: 3 }).packs).toEqual({ core: 3 });
	});
});

describe('share codes', () => {
	const recipe = withPacks(
		lockField(
			rerollField(
				newRecipe({ tier: 2, preset: 'grimdark', seed: '7KQ2M9XA', options: { power: 7 } }),
				'name'
			),
			'quirk',
			'limps'
		),
		{ core: 1 }
	);

	it('round-trip compressed', async () => {
		const code = await encodeShare(recipe);
		expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(await decodeShare(code)).toEqual(recipe);
	});

	it('reads the uncompressed form', async () => {
		const json = JSON.stringify({ v: 1, seed: '7KQ2M9XA', tier: 1, preset: 'modern' });
		const code = 'u.' + btoa(json).replace(/=+$/, '');
		const decoded = await decodeShare(code);
		expect(decoded.preset).toBe('modern');
		expect(decoded.options.power).toBe(5);
	});

	it('rejects garbage and foreign shapes', async () => {
		await expect(decodeShare('not-a-code!!')).rejects.toThrow('not a Strangerloom share code');
		await expect(decodeShare('u.' + btoa('{"v":9}'))).rejects.toThrow('cannot read');
		await expect(decodeShare('u.' + btoa('nope'))).rejects.toThrow('not a Strangerloom share code');
	});

	it('keeps codes short for a default recipe', async () => {
		const code = await encodeShare(
			newRecipe({ tier: 1, preset: 'high-fantasy', seed: '7KQ2M9XA' })
		);
		expect(code.length).toBeLessThan(80);
	});
});
