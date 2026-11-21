// Built-in content: table packs and presets, validated once at load.
import { AdapterPack, PresetFile, TablePack } from '../engine/schema';
import { TableSet } from '../engine/tables';
import type { Catalog } from '../engine/narrative';
import core from './packs/core.json';
import namesFantasy from './packs/names-fantasy.json';
import namesModern from './packs/names-modern.json';
import namesCyberpunk from './packs/names-cyberpunk.json';
import presetsJson from './presets.json';
import d20 from './adapters/d20.json';
import osr from './adapters/osr.json';
import narrative from './adapters/narrative.json';
import statLight from './adapters/stat-light.json';

export const BUILT_IN_PACKS: TablePack[] = [core, namesFantasy, namesModern, namesCyberpunk].map(
	(p) => TablePack.parse(p)
);

export const PRESETS: PresetFile = PresetFile.parse(presetsJson);

/** Built-in data-driven adapters. The generic adapter is code (`engine/adapter/generic.ts`) and is not listed here. */
export const BUILT_IN_ADAPTERS: AdapterPack[] = [d20, osr, narrative, statLight].map((a) =>
	AdapterPack.parse(a)
);

export function adapterById(id: string): AdapterPack | undefined {
	return BUILT_IN_ADAPTERS.find((a) => a.id === id);
}

/** The adapters a preset can use, for pickers: the generic one first, then every pack open to the preset. */
export function adapterChoices(presetId: string): { id: string; name: string }[] {
	return [
		{ id: 'generic', name: 'Generic' },
		...BUILT_IN_ADAPTERS.filter((a) => !a.presets || a.presets.includes(presetId)).map((a) => ({
			id: a.id,
			name: a.name
		}))
	];
}

/** The catalog for one preset: its packs merged in order, plus any extra (user) packs. */
export function catalogFor(presetId: string, extraPacks: TablePack[] = []): Catalog {
	const preset = PRESETS.presets.find((p) => p.id === presetId);
	if (!preset) throw new Error(`Unknown preset "${presetId}".`);
	const packs = preset.packs.map((id) => {
		const pack = BUILT_IN_PACKS.find((p) => p.id === id);
		if (!pack) throw new Error(`Preset "${presetId}" needs pack "${id}", which is not bundled.`);
		return pack;
	});
	return { presets: PRESETS, tables: new TableSet([...packs, ...extraPacks]) };
}
