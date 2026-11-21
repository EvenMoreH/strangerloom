// Values produced in this browser session, so a fresh generation does not repeat a name, quirk or secret.
import type { Narrative, NarrativeField } from '../engine/schema';
import { fieldText } from '../engine/narrative';

const TRACKED: NarrativeField[] = ['name', 'quirk', 'visual', 'secret', 'bond'];
const seen = new Set<string>();

export function remember(npc: Narrative): void {
	for (const field of TRACKED) seen.add(`${field}|${fieldText(npc, field)}`);
}

export function isSeen(field: NarrativeField, value: string): boolean {
	return seen.has(`${field}|${value}`);
}

export function forgetAll(): void {
	seen.clear();
}
