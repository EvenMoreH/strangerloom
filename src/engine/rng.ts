// Seeds and random streams. A seed is 8 characters of Crockford base32. Every field of a result draws from its own
// stream, keyed by seed, field path and a reroll counter, so one field can be rerolled without moving the others.

export type Rng = () => number;

export const SEED_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ALPHABET = SEED_ALPHABET;
export const SEED_LENGTH = 8;

/** A fresh seed from the platform's random source. */
export function newSeed(
	random: (buf: Uint8Array<ArrayBuffer>) => void = (b) => {
		crypto.getRandomValues(b);
	}
): string {
	const bytes = new Uint8Array(SEED_LENGTH);
	random(bytes);
	let out = '';
	for (let i = 0; i < SEED_LENGTH; i++) out += ALPHABET[bytes[i] & 31];
	return out;
}

/** Upper-cases a typed seed, maps the ambiguous letters (O, I, L) and drops separators. Null when not a seed. */
export function normalizeSeed(input: string): string | null {
	const clean = input
		.toUpperCase()
		.replace(/[^0-9A-Z]/g, '')
		.replace(/O/g, '0')
		.replace(/[IL]/g, '1');
	if (clean.length !== SEED_LENGTH) return null;
	for (const ch of clean) if (!ALPHABET.includes(ch)) return null;
	return clean;
}

/** `7KQ2M9XA` shown as `7KQ2-M9XA`. */
export function formatSeed(seed: string): string {
	return `${seed.slice(0, 4)}-${seed.slice(4)}`;
}

/** 64 bits of hash as two unsigned 32-bit words (cyrb53 construction). */
export function hash64(str: string, seed = 0): [number, number] {
	let h1 = 0xdeadbeef ^ seed;
	let h2 = 0x41c6ce57 ^ seed;
	for (let i = 0; i < str.length; i++) {
		const ch = str.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
	h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
	h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return [h1 >>> 0, h2 >>> 0];
}

/** sfc32 generator over four 32-bit words. Returns floats in [0, 1). */
export function sfc32(a: number, b: number, c: number, d: number): Rng {
	a >>>= 0;
	b >>>= 0;
	c >>>= 0;
	d >>>= 0;
	const next = () => {
		const t = (((a + b) >>> 0) + d) >>> 0;
		d = (d + 1) >>> 0;
		a = b ^ (b >>> 9);
		b = (c + (c << 3)) >>> 0;
		c = ((c << 21) | (c >>> 11)) >>> 0;
		c = (c + t) >>> 0;
		return t / 4294967296;
	};
	for (let i = 0; i < 12; i++) next();
	return next;
}

/** The stream of one field: the same seed, path and nonce always give the same sequence. */
export function stream(seed: string, path: string, nonce = 0): Rng {
	const [h1, h2] = hash64(`${seed}|${path}|${nonce}`);
	const [h3, h4] = hash64(`${nonce}|${path}|${seed}`, 0x9e3779b9);
	return sfc32(h1, h2, h3, h4);
}

/** Integer in [lo, hi], both inclusive. */
export function int(rng: Rng, lo: number, hi: number): number {
	if (hi < lo) [lo, hi] = [hi, lo];
	return lo + Math.floor(rng() * (hi - lo + 1));
}

export function chance(rng: Rng, p: number): boolean {
	return rng() < p;
}

export function pickOne<T>(rng: Rng, items: readonly T[]): T {
	return items[Math.floor(rng() * items.length)];
}

/** Weighted pick; `weight` reads the weight of an item (default 1). */
export function pickWeighted<T>(
	rng: Rng,
	items: readonly T[],
	weight: (item: T) => number = () => 1
): T {
	let total = 0;
	for (const item of items) total += weight(item);
	let roll = rng() * total;
	for (const item of items) {
		roll -= weight(item);
		if (roll < 0) return item;
	}
	return items[items.length - 1];
}
