// Hash router. Routes:
//   #/                 generate
//   #/s/<code>         shared recipe
//   #/library
//   #/npc/<id>
//   #/party/<id>
//   #/editor
//   #/tools
//   #/settings
//   #/print/npc/<id>[,<id>...]   print view of saved NPCs
//   #/print/party/<id>[,<id>...] print view of saved parties

export type Route =
	| { screen: 'generate' }
	| { screen: 'shared'; code: string }
	| { screen: 'library' }
	| { screen: 'npc'; id: string }
	| { screen: 'party'; id: string }
	| { screen: 'editor' }
	| { screen: 'tools' }
	| { screen: 'settings' }
	| { screen: 'print'; kind: 'npc' | 'party'; ids: string[] };

export function parseRoute(hash: string): Route {
	const path = hash.replace(/^#\/?/, '').split('?')[0];
	const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
	switch (parts[0]) {
		case 's':
			return parts[1] ? { screen: 'shared', code: parts[1] } : { screen: 'generate' };
		case 'library':
			return { screen: 'library' };
		case 'npc':
			return parts[1] ? { screen: 'npc', id: parts[1] } : { screen: 'library' };
		case 'party':
			return parts[1] ? { screen: 'party', id: parts[1] } : { screen: 'library' };
		case 'editor':
			return { screen: 'editor' };
		case 'tools':
			return { screen: 'tools' };
		case 'settings':
			return { screen: 'settings' };
		case 'print': {
			const kind = parts[1] === 'party' ? 'party' : parts[1] === 'npc' ? 'npc' : null;
			const ids = (parts[2] ?? '').split(',').filter(Boolean);
			return kind && ids.length ? { screen: 'print', kind, ids } : { screen: 'library' };
		}
		default:
			return { screen: 'generate' };
	}
}

export function routeToHash(route: Route): string {
	switch (route.screen) {
		case 'generate':
			return '#/';
		case 'shared':
			return `#/s/${encodeURIComponent(route.code)}`;
		case 'library':
			return '#/library';
		case 'npc':
			return `#/npc/${encodeURIComponent(route.id)}`;
		case 'party':
			return `#/party/${encodeURIComponent(route.id)}`;
		case 'editor':
			return '#/editor';
		case 'tools':
			return '#/tools';
		case 'settings':
			return '#/settings';
		case 'print':
			return `#/print/${route.kind}/${encodeURIComponent(route.ids.join(','))}`;
	}
}

function createRouter() {
	let route = $state<Route>(parseRoute(typeof location === 'undefined' ? '' : location.hash));
	if (typeof window !== 'undefined') {
		window.addEventListener('hashchange', () => {
			route = parseRoute(location.hash);
		});
	}
	return {
		get route() {
			return route;
		},
		go(next: Route) {
			location.hash = routeToHash(next);
		}
	};
}

export const router = createRouter();
