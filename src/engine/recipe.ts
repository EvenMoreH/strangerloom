// Recipes: everything needed to rebuild a result. Operations return new objects; nothing is mutated.
import { newSeed } from './rng';
import { Recipe, type RecipeOptions, type RecipeFilters } from './schema';

export type { Recipe };

export interface NewRecipeInput {
	tier: 1 | 2 | 3;
	preset: string;
	seed?: string;
	options?: Partial<RecipeOptions>;
	filters?: Partial<RecipeFilters>;
	adapter?: string;
}

export function newRecipe(input: NewRecipeInput): Recipe {
	return Recipe.parse({
		v: 1,
		seed: input.seed ?? newSeed(),
		tier: input.tier,
		preset: input.preset,
		options: input.options ?? {},
		filters: input.filters ?? {},
		...(input.adapter ? { adapter: input.adapter } : {})
	});
}

/** A new seed, nonces cleared, locks kept. */
export function rerollAll(recipe: Recipe, seed = newSeed()): Recipe {
	return { ...recipe, seed, nonces: {} };
}

/** The field draws from its next stream; everything else stays. A locked field is unlocked by the reroll. */
export function rerollField(recipe: Recipe, path: string): Recipe {
	const locks = { ...recipe.locks };
	delete locks[path];
	return { ...recipe, nonces: { ...recipe.nonces, [path]: (recipe.nonces[path] ?? 0) + 1 }, locks };
}

export function lockField(recipe: Recipe, path: string, value: unknown): Recipe {
	return { ...recipe, locks: { ...recipe.locks, [path]: value } };
}

export function unlockField(recipe: Recipe, path: string): Recipe {
	const locks = { ...recipe.locks };
	delete locks[path];
	return { ...recipe, locks };
}

export function isLocked(recipe: Recipe, path: string): boolean {
	return Object.prototype.hasOwnProperty.call(recipe.locks, path);
}

/** The recipe with the pack versions it was generated against. */
export function withPacks(recipe: Recipe, versions: Record<string, number>): Recipe {
	return { ...recipe, packs: { ...versions } };
}

// Share codes: recipe JSON, deflate-raw compressed when the platform has CompressionStream, base64url encoded.
// The uncompressed form starts with "u.". Whichever form is shorter is used.

const toBase64Url = (bytes: Uint8Array): string =>
	btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

const fromBase64Url = (text: string): Uint8Array => {
	const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
	const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
	return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, transform: GenericTransformStream): Promise<Uint8Array> {
	const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Drops default-valued and empty parts so the code stays short. */
function compact(recipe: Recipe): Record<string, unknown> {
	const out: Record<string, unknown> = {
		v: recipe.v,
		seed: recipe.seed,
		tier: recipe.tier,
		preset: recipe.preset
	};
	const defaults = Recipe.parse({
		v: 1,
		seed: recipe.seed,
		tier: recipe.tier,
		preset: recipe.preset
	});
	const options = Object.fromEntries(
		Object.entries(recipe.options).filter(
			([k, v]) => JSON.stringify(v) !== JSON.stringify(defaults.options[k as keyof RecipeOptions])
		)
	);
	const filters = Object.fromEntries(
		Object.entries(recipe.filters).filter(([, v]) => v.length > 0)
	);
	if (Object.keys(options).length) out.options = options;
	if (Object.keys(filters).length) out.filters = filters;
	if (Object.keys(recipe.nonces).length) out.nonces = recipe.nonces;
	if (Object.keys(recipe.locks).length) out.locks = recipe.locks;
	if (Object.keys(recipe.packs).length) out.packs = recipe.packs;
	if (recipe.adapter) out.adapter = recipe.adapter;
	return out;
}

/** The shorter of the compressed and the uncompressed form. */
export async function encodeShare(recipe: Recipe): Promise<string> {
	const json = new TextEncoder().encode(JSON.stringify(compact(recipe)));
	const plain = `u.${toBase64Url(json)}`;
	if (typeof CompressionStream === 'undefined') return plain;
	const deflated = toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
	return deflated.length < plain.length ? deflated : plain;
}

export class ShareError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ShareError';
	}
}

export async function decodeShare(code: string): Promise<Recipe> {
	let json: string;
	try {
		if (code.startsWith('u.')) {
			json = new TextDecoder().decode(fromBase64Url(code.slice(2)));
		} else {
			if (typeof DecompressionStream === 'undefined')
				throw new ShareError('This browser cannot read compressed links.');
			const inflated = await pipe(fromBase64Url(code), new DecompressionStream('deflate-raw'));
			json = new TextDecoder().decode(inflated);
		}
	} catch (err) {
		if (err instanceof ShareError) throw err;
		throw new ShareError('This link is not a Strangerloom share code.');
	}
	let data: unknown;
	try {
		data = JSON.parse(json);
	} catch {
		throw new ShareError('This link is not a Strangerloom share code.');
	}
	const parsed = Recipe.safeParse(data);
	if (!parsed.success) throw new ShareError('This link holds a recipe this version cannot read.');
	return parsed.data;
}
