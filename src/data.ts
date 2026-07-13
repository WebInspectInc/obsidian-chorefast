import type { Plugin } from 'obsidian';
import type { ChorefastData } from './types';
import { DEFAULT_DATA } from './types';

const STORAGE_KEY = 'chorefast-data';

export class DataStore {
	private plugin: Plugin;
	private cache: ChorefastData | null = null;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	async load(): Promise<ChorefastData> {
		if (this.cache) return this.cache;
		const stored = await this.plugin.loadData();
		const data = stored?.[STORAGE_KEY] as Partial<ChorefastData> | undefined;
		this.cache = {
			sourceFile: data?.sourceFile ?? null,
			serverUrl: data?.serverUrl ?? DEFAULT_DATA.serverUrl,
			syncId: data?.syncId ?? '',
		};
		return this.cache;
	}

	async save(data: ChorefastData): Promise<void> {
		this.cache = data;
		const stored = await this.plugin.loadData() ?? {};
		stored[STORAGE_KEY] = data;
		await this.plugin.saveData(stored);
	}
}
