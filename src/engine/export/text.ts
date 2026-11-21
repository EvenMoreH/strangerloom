// Shared pieces of the text exports: field labels and the callback that turns a field into display text.
import type { NarrativeField, Shape } from '../schema';

/** The narrative rows of a card, in card order, with their labels. */
export const NARRATIVE_LABELS: [NarrativeField, string][] = [
	['ancestry', 'Ancestry'],
	['gender', 'Gender'],
	['pronouns', 'Pronouns'],
	['age', 'Age'],
	['occupation', 'Occupation'],
	['quirk', 'Quirk'],
	['visual', 'Look'],
	['trait', 'Trait'],
	['ideal', 'Ideal'],
	['bond', 'Bond'],
	['flaw', 'Flaw'],
	['voice', 'Speaking'],
	['mood', 'Mood'],
	['attitude', 'Attitude'],
	['secret', 'Secret']
];

export interface TextOptions {
	/** Display text of a narrative field (labels for ancestry and culture, age with its stage). */
	text: (field: NarrativeField) => string;
	/** Fields left out of the export. */
	hidden?: (field: NarrativeField) => boolean;
	/** The shape of the table behind a field (`Table.shape`), for the blurb; absent means the built-in shape. */
	shape?: (field: NarrativeField) => Shape | undefined;
}

/** The visible rows: label and text. */
export function narrativeRows(o: TextOptions): [string, string][] {
	return NARRATIVE_LABELS.filter(([f]) => !o.hidden?.(f)).map(([f, label]) => [label, o.text(f)]);
}
