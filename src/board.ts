import type { BasesEntry, BasesQueryResult, BasesViewConfig } from 'obsidian';

export interface BoardCard {
	path: string;
	title: string;
	properties: Record<string, string>;
}

export interface BoardColumn {
	key: string;
	label: string;
	cards: BoardCard[];
}

export interface BoardPayload {
	version: 1;
	columns: BoardColumn[];
}

export function getEntryTitle(entry: BasesEntry, config: BasesViewConfig): string {
	const titleProperty = config.getAsPropertyId('titleProperty');
	if (titleProperty) {
		const value = entry.getValue(titleProperty);
		if (value && value.isTruthy()) return value.toString();
	}
	return entry.file.basename;
}

export function buildBoard(data: BasesQueryResult, config: BasesViewConfig): BoardPayload {
	const order = config.getOrder();
	const columns: BoardColumn[] = [];

	for (const group of data.groupedData) {
		if (!group.hasKey()) continue;
		const label = group.key?.toString() ?? 'None';
		const cards: BoardCard[] = group.entries.map(entry => {
			const properties: Record<string, string> = {};
			for (const propertyId of order) {
				const value = entry.getValue(propertyId);
				if (value && value.isTruthy()) properties[propertyId] = value.toString();
			}
			return {
				path: entry.file.path,
				title: getEntryTitle(entry, config),
				properties,
			};
		});
		columns.push({ key: label, label, cards });
	}

	return { version: 1, columns };
}
