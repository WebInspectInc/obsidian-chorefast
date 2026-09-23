import { PluginSettingTab, Setting, Notice, requestUrl, Modal, App } from 'obsidian';
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

		// Sync Secret
		new Setting(containerEl)
			.setName('Sync Secret')
			.setDesc('Your sync write secret. Required to push changes. Leave blank for read-only or to disconnect.')
			.addText(text => {
				text.setValue(data.syncSecret);
				text.onChange(async (value) => {
					data.syncSecret = value.trim();
					await this.plugin.saveDataState();
					this.display();
				});
			});

		// Create new sync
		new Setting(containerEl)
			.setName('Create new sync')
			.setDesc('Open the web app to create a sync and get your sync ID and secret.')
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
			const publicUrl = `${data.serverUrl}/s/${data.syncId}`;
			const secretUrl = data.syncSecret ? `${publicUrl}#${data.syncSecret}` : publicUrl;
			new Setting(containerEl)
				.setName('Public URL')
				.setDesc('Read-only URL. Use the Full URL below for editing.')
				.addText(text => {
					text.setValue(publicUrl);
					text.setDisabled(true);
				})
				.addButton(btn => {
					btn.setButtonText('Copy');
					btn.onClick(() => {
						void navigator.clipboard.writeText(publicUrl).then(() => {
							new Notice('Public URL copied to clipboard!');
						}).catch(() => {
							new Notice('Failed to copy URL', 4000);
						});
					});
				});
			new Setting(containerEl)
				.setName('Full URL (with secret)')
				.setDesc('Use this URL on your phone to view and complete tasks.')
				.addText(text => {
					text.setValue(secretUrl);
					text.setDisabled(true);
				})
				.addButton(btn => {
					btn.setButtonText('Copy');
					btn.onClick(() => {
						void navigator.clipboard.writeText(secretUrl).then(() => {
							new Notice('Full URL copied to clipboard!');
						}).catch(() => {
							new Notice('Failed to copy URL', 4000);
						});
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
					btn.onClick(() => {
						new ConfirmModal(this.app, 'Are you sure? This will permanently delete the sync and its board from the server.', async () => {
							btn.setDisabled(true);
							btn.setButtonText('Deleting...');
							try {
								const url = data.serverUrl.replace(/\/+$/, '');
								const headers: Record<string, string> = {};
								if (data.syncSecret) headers['x-sync-secret'] = data.syncSecret;
								const res = await requestUrl({
									url: `${url}/api/sync/${data.syncId}`,
									method: 'DELETE',
									headers,
									throw: false,
								});
								if (res.status >= 400 && res.status !== 404) {
									throw new Error(`HTTP ${res.status}`);
								}
								data.syncId = '';
								data.syncSecret = '';
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
						}).open();
					});
				});
		}
	}
}

class ConfirmModal extends Modal {
	private message: string;
	private onConfirm: () => void | Promise<void>;

	constructor(app: App, message: string, onConfirm: () => void | Promise<void>) {
		super(app);
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl('p', { text: this.message });
		const btnRow = contentEl.createDiv({ cls: 'cf-confirm-row' });
		const yesBtn = btnRow.createEl('button', { text: 'Yes', cls: 'mod-warning' });
		yesBtn.addEventListener('click', () => {
			void this.onConfirm();
			this.close();
		});
		const noBtn = btnRow.createEl('button', { text: 'No' });
		noBtn.addEventListener('click', () => {
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
