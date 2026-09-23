import { Notice, Plugin } from 'obsidian';
import { DataStore } from './src/data';
import { CHOREFAST_VIEW_TYPE, ChorefastKanbanView } from './src/bases-view';
import { ChorefastSettingTab } from './src/settings';
import type { ChorefastData } from './src/types';

export default class ChorefastPlugin extends Plugin {
	private store: DataStore;
	private data: ChorefastData;
	private activeView: ChorefastKanbanView | null = null;

	async onload() {
		this.store = new DataStore(this);
		this.data = await this.store.load();

		const registered = this.registerBasesView(CHOREFAST_VIEW_TYPE, {
			name: 'Chorefast Kanban',
			icon: 'dices',
			factory: (controller, containerEl) => new ChorefastKanbanView(controller, containerEl, this),
			options: () => [
				{
					type: 'property',
					key: 'titleProperty',
					displayName: 'Card title property',
					placeholder: 'File name',
				},
				{
					type: 'text',
					key: 'doneValue',
					displayName: 'Done column value',
					default: 'Done',
				},
				{
					type: 'toggle',
					key: 'showDice',
					displayName: 'Show random pick buttons',
					default: true,
				},
			],
		});

		if (!registered) {
			new Notice('Chorefast requires Bases to be enabled in this vault.', 6000);
		}

		this.addCommand({
			id: 'publish-board',
			name: 'Publish board to web',
			callback: () => void this.publishActiveBoard(),
		});

		this.addSettingTab(new ChorefastSettingTab(this));
	}

	onunload() {
		this.activeView = null;
	}

	getData(): ChorefastData {
		return this.data;
	}

	setActiveView(view: ChorefastKanbanView): void {
		this.activeView = view;
	}

	clearActiveView(view: ChorefastKanbanView): void {
		if (this.activeView === view) this.activeView = null;
	}

	async saveDataState(): Promise<void> {
		await this.store.save(this.data);
	}

	private async publishActiveBoard(): Promise<void> {
		if (!this.activeView) {
			new Notice('Open a Chorefast Kanban view first.', 4000);
			return;
		}
		await this.activeView.publish();
	}
}
