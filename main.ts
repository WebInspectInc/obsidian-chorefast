import { Plugin, WorkspaceLeaf } from 'obsidian';
import { DataStore } from './src/data';
import { ChorefastView, VIEW_TYPE_CHOREFAST } from './src/view';
import { ChorefastSettingTab } from './src/settings';
import type { ChorefastData } from './src/types';

export default class ChorefastPlugin extends Plugin {
	private store: DataStore;
	private data: ChorefastData;

	async onload() {
		this.store = new DataStore(this);
		this.data = await this.store.load();

		this.registerView(VIEW_TYPE_CHOREFAST, (leaf) => new ChorefastView(leaf, this.store, this.data));

		this.addRibbonIcon('dice', 'Open Chorefast', () => {
			void this.activateView();
		});

		this.addCommand({
			id: 'open',
			name: 'Open',
			callback: () => this.activateView(),
		});

		this.addSettingTab(new ChorefastSettingTab(this));
	}

	onunload() {

	}

	getData(): ChorefastData {
		return this.data;
	}

	async saveDataState(): Promise<void> {
		await this.store.save(this.data);
		// Refresh any open views so they pick up new sync settings
		this.app.workspace.getLeavesOfType(VIEW_TYPE_CHOREFAST).forEach(leaf => {
			const view = leaf.view;
			if (view instanceof ChorefastView) {
				view.refresh();
			}
		});
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_CHOREFAST);
		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: VIEW_TYPE_CHOREFAST, active: true });
		}
		if (leaf) {
			await workspace.revealLeaf(leaf);
		}
	}
}
