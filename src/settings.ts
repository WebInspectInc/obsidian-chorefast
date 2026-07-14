import { PluginSettingTab, Setting, Notice } from 'obsidian';
import type ChorefastPlugin from '../main';

export class ChorefastSettingTab extends PluginSettingTab {
	plugin: ChorefastPlugin;

	constructor(plugin: ChorefastPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const data = this.plugin.getData();

		// Server URL
		new Setting(containerEl)
			.setName('Server URL')
			.setDesc('The Chorefast web service to sync with. No trailing slash.')
			.addText(text => {
				text.setValue(data.serverUrl);
				text.onChange(async (value) => {
					let url = value.trim();
					url = url.replace(/\/+$/, '');
					data.serverUrl = url || 'https://chore.fast';
					await this.plugin.saveDataState();
				});
			});

		// Sync ID
		new Setting(containerEl)
			.setName('Sync ID')
			.setDesc('Your unique sync identifier. Leave blank to disconnect.')
			.addText(text => {
				text.setValue(data.syncId);
				text.onChange(async (value) => {
					data.syncId = value.trim();
					await this.plugin.saveDataState();
					this.display();
				});
			});

		// Create new sync
		new Setting(containerEl)
			.setName('Create new sync')
			.setDesc('Open the web app to create a sync and get your sync ID.')
			.addButton(btn => {
				btn.setButtonText('Open in Browser');
				btn.onClick(() => {
					const url = data.serverUrl.replace(/\/+$/, '');
					if (!url) {
						new Notice('Please set a Server URL first.', 4000);
						return;
					}
					window.open(`${url}/create-sync`, '_blank');
				});
			});

		// Public URL display
		if (data.syncId) {
			const url = `${data.serverUrl}/s/${data.syncId}`;
			new Setting(containerEl)
				.setName('Public URL')
				.setDesc('Visit this URL on any device to view and complete tasks.')
				.addText(text => {
					text.setValue(url);
					text.setDisabled(true);
				})
				.addButton(btn => {
					btn.setButtonText('Copy');
					btn.onClick(() => {
						navigator.clipboard.writeText(url);
						new Notice('URL copied to clipboard!');
					});
				});
		}

		// Delete sync
		if (data.syncId) {
			new Setting(containerEl)
				.setName('Delete this sync')
				.setDesc('Remove this sync from the server. This cannot be undone.')
				.addButton(btn => {
					btn.setButtonText('Delete');
					btn.setWarning();
					btn.onClick(async () => {
						const ok = confirm('Are you sure? This will permanently delete the sync and its task history from the server.');
						if (!ok) return;
						btn.setDisabled(true);
						btn.setButtonText('Deleting...');
						try {
							const url = data.serverUrl.replace(/\/+$/, '');
							const res = await fetch(`${url}/api/sync/${data.syncId}`, { method: 'DELETE' });
							if (!res.ok && res.status !== 404) {
								throw new Error(`HTTP ${res.status}`);
							}
							data.syncId = '';
							await this.plugin.saveDataState();
							new Notice('Sync deleted. A new one can be created anytime.', 4000);
							this.display();
						} catch (e) {
							console.error('Chorefast delete sync error:', e);
							const msg = e instanceof Error ? e.message : String(e);
							new Notice(`Failed to delete sync: ${msg}`, 6000);
						} finally {
							btn.setDisabled(false);
							btn.setButtonText('Delete');
						}
					});
				});
		}

		// Source file
		new Setting(containerEl)
			.setName('Source file')
			.setDesc('The markdown file used as your chore database.')
			.addText(text => {
				text.setValue(data.sourceFile ?? '');
				text.setDisabled(true);
			});
	}
}
