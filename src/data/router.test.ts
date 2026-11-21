import { describe, expect, it } from 'vitest';
import { parseRoute, routeToHash, type Route } from './router.svelte';

describe('parseRoute', () => {
	it('reads every route', () => {
		expect(parseRoute('')).toEqual({ screen: 'generate' });
		expect(parseRoute('#/')).toEqual({ screen: 'generate' });
		expect(parseRoute('#/s/abc')).toEqual({ screen: 'shared', code: 'abc' });
		expect(parseRoute('#/library')).toEqual({ screen: 'library' });
		expect(parseRoute('#/npc/1')).toEqual({ screen: 'npc', id: '1' });
		expect(parseRoute('#/party/2')).toEqual({ screen: 'party', id: '2' });
		expect(parseRoute('#/editor')).toEqual({ screen: 'editor' });
		expect(parseRoute('#/tools')).toEqual({ screen: 'tools' });
		expect(parseRoute('#/settings')).toEqual({ screen: 'settings' });
		expect(parseRoute('#/print/npc/a,b')).toEqual({
			screen: 'print',
			kind: 'npc',
			ids: ['a', 'b']
		});
		expect(parseRoute('#/print/party/p')).toEqual({ screen: 'print', kind: 'party', ids: ['p'] });
	});

	it('falls back on incomplete and unknown paths', () => {
		expect(parseRoute('#/s')).toEqual({ screen: 'generate' });
		expect(parseRoute('#/npc')).toEqual({ screen: 'library' });
		expect(parseRoute('#/nothing')).toEqual({ screen: 'generate' });
		expect(parseRoute('#/print/npc')).toEqual({ screen: 'library' });
		expect(parseRoute('#/print/thing/a')).toEqual({ screen: 'library' });
	});

	it('round-trips through routeToHash', () => {
		const routes: Route[] = [
			{ screen: 'generate' },
			{ screen: 'shared', code: 'a b' },
			{ screen: 'library' },
			{ screen: 'npc', id: 'x/y' },
			{ screen: 'party', id: 'p' },
			{ screen: 'print', kind: 'npc', ids: ['a', 'b c'] },
			{ screen: 'editor' },
			{ screen: 'tools' },
			{ screen: 'settings' }
		];
		for (const route of routes) expect(parseRoute(routeToHash(route))).toEqual(route);
	});
});
