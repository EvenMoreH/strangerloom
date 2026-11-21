// Markdown export of one NPC or one party, rendered for the chosen adapter.
import type { StatBlock } from '../adapter';
import type { ChronicleEntry, Npc, Party } from '../schema';
import { blurbOf } from './blurb';
import { narrativeRows, type TextOptions } from './text';

/** Options shared by the exports: the text callbacks per member, the seed line. */
export interface MarkdownOptions {
	seed?: string;
}

function heading(level: number, text: string): string {
	return `${'#'.repeat(Math.min(6, level))} ${text}`;
}

/** The body of an NPC: summary, narrative rows and the stat block sections under headings of `level + 1`. */
export function npcMarkdownBody(
	npc: Npc,
	block: StatBlock | null,
	o: TextOptions,
	level = 1
): string[] {
	const n = npc.narrative;
	const out: string[] = [];
	const summary = blurbOf(n, o);
	if (summary) out.push(`*${summary}*`, '');
	for (const [label, text] of narrativeRows(o)) out.push(`- **${label}:** ${text}`);
	if (block) {
		out.push('', `*${block.subtitle}*`);
		for (const s of block.sections) {
			out.push('', heading(level + 1, s.label));
			if (s.note) out.push(`*${s.note}*`, '');
			let group: string | undefined;
			for (const l of s.lines) {
				if (l.group && l.group !== group) {
					group = l.group;
					out.push(`**${group}**`, '');
				}
				const roll = l.roll ? ` \`${l.roll}\`` : '';
				const note = l.note ? ` — ${l.note}` : '';
				out.push(`- ${l.label ? `**${l.label}:** ` : ''}${l.value}${roll}${note}`);
			}
			if (s.lines.length === 0) out.push('- None');
		}
	}
	void n;
	return out;
}

export function npcMarkdown(
	npc: Npc,
	block: StatBlock | null,
	o: TextOptions,
	m: MarkdownOptions = {}
): string {
	const n = npc.narrative;
	const title = o.hidden?.('pronouns') ? n.name.full : `${n.name.full} (${n.pronouns})`;
	const lines = [heading(1, title), '', ...npcMarkdownBody(npc, block, o, 1)];
	if (m.seed) lines.push('', `Seed: ${m.seed}`);
	return lines.join('\n') + '\n';
}

export interface PartyMarkdownOptions extends MarkdownOptions {
	/** Text options per member index. */
	member: (i: number) => TextOptions;
	blocks: (StatBlock | null)[];
	/** Member indices in display order; the natural order when absent. */
	order?: number[];
	averagePower?: number;
}

export function partyMarkdown(party: Party, o: PartyMarkdownOptions): string {
	const name = (i: number) => party.members[i].narrative.name.full;
	const order = o.order ?? party.members.map((_, i) => i);
	const lines = [
		heading(1, party.name),
		'',
		`*${party.members.length} members${o.averagePower !== undefined ? ` | average power ${o.averagePower}` : ''} | led by ${name(party.leaderIndex)}*`,
		'',
		`- **Reputation:** ${party.reputation}`,
		`- **Goal:** ${party.goal}`,
		`- **Hook:** ${party.hook}`,
		`- **Tactics:** ${party.tactics}`,
		`- **Loot:** ${party.loot.pool} | ${party.loot.notable}`,
		'',
		heading(2, 'Relationships'),
		'',
		...party.relationships.map((r) => `- **${r.kind}:** ${r.text}`),
		'',
		heading(2, 'Members')
	];
	for (const i of order) {
		const m = party.members[i];
		const title = `${name(i)}${i === party.leaderIndex ? ' (leader)' : ''}`;
		lines.push(
			'',
			heading(3, title),
			'',
			...npcMarkdownBody(m, o.blocks[i] ?? null, o.member(i), 3)
		);
	}
	if (o.seed) lines.push('', `Seed: ${o.seed}`);
	return lines.join('\n') + '\n';
}

/** The chronicle as a Markdown section, newest entry first; empty when there are no entries. */
export function chronicleMarkdown(entries: ChronicleEntry[]): string {
	if (!entries.length) return '';
	const lines = [...entries]
		.sort((a, b) => b.at.localeCompare(a.at))
		.map((e) => `- **${e.at.slice(0, 10)}${e.label ? `, ${e.label}` : ''}.** ${e.text}`);
	return `\n## Chronicle\n\n${lines.join('\n')}\n`;
}
