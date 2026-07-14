import { ItemView, WorkspaceLeaf, TFile, Modal, Setting, Notice } from 'obsidian';
import type { ChorefastData } from './types';
import { DataStore } from './data';

export const VIEW_TYPE_CHOREFAST = 'chorefast-view';

interface ParsedTask {
	originalLine: string;
	title: string;
	completed: boolean;
	difficulty: 'easy' | 'medium' | 'hard';
	recurrence: 'one-time' | 'weekly' | 'monthly' | 'yearly';
	dueDate: string | null;
}

const DIFFICULTY_EMOJIS: Record<string, string> = {
	easy: '🟢',
	medium: '🟡',
	hard: '🔴',
};

const DIFFICULTY_BY_EMOJI: Record<string, 'easy' | 'medium' | 'hard'> = {
	'🟢': 'easy',
	'🟡': 'medium',
	'🔴': 'hard',
};

function parseTasksFromMarkdown(content: string): ParsedTask[] {
	const tasks: ParsedTask[] = [];
	const lines = content.split(/\r?\n/);
	const recTags = ['#one-time', '#weekly', '#monthly', '#yearly'];

	for (const line of lines) {
		const trimmed = line.trim();
		const match = trimmed.match(/^- \[([ xX])\]\s+(.*)$/);
		if (!match) continue;
		const checked = match[1] !== ' ';
		let rest = match[2].trim();

		let difficulty: 'easy' | 'medium' | 'hard' = 'medium';

		// Check emojis first
		for (const [emoji, diff] of Object.entries(DIFFICULTY_BY_EMOJI)) {
			if (rest.includes(emoji)) {
				difficulty = diff;
				rest = rest.replace(emoji, '').trim();
			}
		}

		let recurrence: 'one-time' | 'weekly' | 'monthly' | 'yearly' = 'one-time';
		for (const tag of recTags) {
			if (rest.includes(tag)) {
				recurrence = tag.slice(1) as 'one-time' | 'weekly' | 'monthly' | 'yearly';
				rest = rest.replace(tag, '').trim();
			}
		}

		let dueDate: string | null = null;
		const dueMatch = rest.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
		if (dueMatch) {
			dueDate = dueMatch[1];
			rest = rest.replace(dueMatch[0], '').trim();
		}

		if (rest) {
			tasks.push({ originalLine: line, title: rest, completed: checked, difficulty, recurrence, dueDate });
		}
	}

	return tasks;
}

function buildTaskLine(title: string, completed: boolean, difficulty: string, recurrence: string, dueDate: string | null): string {
	let line = `- [${completed ? 'x' : ' '}] ${title}`;
	line += ` ${DIFFICULTY_EMOJIS[difficulty]}`;
	if (recurrence !== 'one-time') line += ` #${recurrence}`;
	if (dueDate) line += ` 📅 ${dueDate}`;
	return line;
}

export class ChorefastView extends ItemView {
	private store: DataStore;
	private data: ChorefastData;
	private container: HTMLElement;
	private spinning = false;
	private selectedTaskTitle: string | null = null;
	private fileWatchRef: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, store: DataStore, initialData: ChorefastData) {
		super(leaf);
		this.store = store;
		this.data = initialData;
	}

	getViewType() {
		return VIEW_TYPE_CHOREFAST;
	}

	getDisplayText() {
		return 'Chorefast';
	}

	async onOpen() {
		this.container = this.contentEl.createDiv({ cls: 'chorefast-container' });
		this.registerFileWatcher();
		this.render();
	}

	async onClose() {
		this.container.empty();
		this.unregisterFileWatcher();
	}

	refresh() {
		this.render();
	}

	private registerFileWatcher() {
		const handler = (file: TFile) => {
			if (this.data.sourceFile && file.path === this.data.sourceFile) {
				this.render();
			}
		};
		this.app.vault.on('modify', handler);
		this.fileWatchRef = () => this.app.vault.off('modify', handler);
	}

	private unregisterFileWatcher() {
		if (this.fileWatchRef) {
			this.fileWatchRef();
			this.fileWatchRef = null;
		}
	}

	private async persist() {
		await this.store.save(this.data);
	}

	private todayStr(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	private async readSourceTasks(): Promise<ParsedTask[]> {
		if (!this.data.sourceFile) return [];
		const file = this.app.vault.getAbstractFileByPath(this.data.sourceFile);
		if (!file || !(file instanceof TFile)) return [];
		const content = await this.app.vault.cachedRead(file);
		return parseTasksFromMarkdown(content);
	}

	private async replaceFileLine(oldLine: string, newLine: string | null) {
		if (!this.data.sourceFile) return;
		const file = this.app.vault.getAbstractFileByPath(this.data.sourceFile);
		if (!file || !(file instanceof TFile)) return;
		try {
			const content = await this.app.vault.read(file);
			const lines = content.split(/\r?\n/);
			const idx = lines.findIndex(l => l === oldLine);
			if (idx === -1) return;
			if (newLine === null) {
				lines.splice(idx, 1);
			} else {
				lines[idx] = newLine;
			}
			await this.app.vault.modify(file, lines.join('\n'));
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			new Notice(`Failed to edit file: ${msg}`, 4000);
		}
	}

	private async appendFileLine(line: string) {
		if (!this.data.sourceFile) return;
		const file = this.app.vault.getAbstractFileByPath(this.data.sourceFile);
		if (!file || !(file instanceof TFile)) return;
		try {
			const content = await this.app.vault.read(file);
			const newContent = content.endsWith('\n') ? content + line + '\n' : content + '\n' + line + '\n';
			await this.app.vault.modify(file, newContent);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			new Notice(`Failed to edit file: ${msg}`, 4000);
		}
	}

	private render() {
		this.container.empty();

		// Header: filename + edit button + sync
		if (this.data.sourceFile) {
			const header = this.container.createDiv({ cls: 'cf-header' });
			const nameRow = header.createDiv({ cls: 'cf-name-row' });
			const basename = this.data.sourceFile.split('/').pop() || this.data.sourceFile;
			nameRow.createEl('h1', { text: basename });
			const editFileBtn = nameRow.createEl('button', { text: '✎', cls: 'cf-icon-btn' });
			editFileBtn.addEventListener('click', () => {
				const file = this.app.vault.getAbstractFileByPath(this.data.sourceFile!);
				if (file && file instanceof TFile) {
					this.app.workspace.getLeaf().openFile(file);
				}
			});
			const changeBtn = nameRow.createEl('button', { text: 'Change', cls: 'cf-icon-btn' });
			changeBtn.addEventListener('click', () => this.showLinkFileModal());

			// Sync button
			if (this.data.syncId) {
				const syncBtn = nameRow.createEl('button', { text: '🔄', cls: 'cf-icon-btn', attr: { title: 'Sync to web' } });
				syncBtn.addEventListener('click', () => this.performSync());
				const url = `${this.data.serverUrl}/s/${this.data.syncId}`;
				const syncUrl = header.createEl('div', { cls: 'cf-sync-url' });
				syncUrl.createEl('a', { text: url, cls: 'cf-sync-link' }).setAttr('href', url);
				const copyBtn = syncUrl.createEl('button', { text: '📋', cls: 'cf-icon-btn', attr: { title: 'Copy URL' } });
				copyBtn.addEventListener('click', () => {
					navigator.clipboard.writeText(url);
					new Notice('URL copied to clipboard!');
				});
			} else {
				const connectBtn = nameRow.createEl('button', { text: '🌐', cls: 'cf-icon-btn', attr: { title: 'Connect to web' } });
				connectBtn.addEventListener('click', () => {
					new Notice('Configure web sync in Settings → Community Plugins → Chorefast');
				});
			}
		}

		if (!this.data.sourceFile) {
			this.container.createDiv({ cls: 'cf-empty', text: 'No file linked. Choose a markdown file to use as your chore database.' });
			const linkBtn = this.container.createEl('button', { text: '🔗 Link to file', cls: 'mod-cta' });
			linkBtn.addEventListener('click', () => this.showLinkFileModal());
			return;
		}

		// Slot machine
		const slotArea = this.container.createDiv({ cls: 'cf-slot-area' });
		const spinBtn = slotArea.createEl('button', {
			text: this.selectedTaskTitle !== null ? '🎲 Pick Another' : '🎲 Pick a Chore',
			cls: 'cf-spin-btn mod-cta',
		});
		spinBtn.addEventListener('click', () => this.spin(slotArea, spinBtn));

		// Load tasks
		const tasks = this.readSourceTasks();
		// We can't await in render synchronously, so we schedule it
		// Actually, we can use an async IIFE
		(async () => {
			const allTasks = await tasks;
			const today = this.todayStr();
			const active = allTasks.filter(t => !t.completed && (!t.dueDate || t.dueDate <= today));
			const inactive = allTasks.filter(t => !t.completed && t.dueDate && t.dueDate > today);
			const done = allTasks.filter(t => t.completed);
			const allDone = allTasks.length > 0 && active.length === 0 && inactive.length === 0;

			if (allTasks.length === 0) {
				this.container.createDiv({ cls: 'cf-empty', text: 'No tasks found in linked file.' });
			}

			const list = this.container.createDiv({ cls: 'cf-list' });
			for (const task of active) {
				this.renderTaskCard(list, task);
			}

			if (inactive.length > 0) {
				this.container.createEl('p', { text: 'Upcoming', cls: 'cf-section-label' });
				for (const task of inactive) {
					this.renderInactiveCard(list, task);
				}
			}

			const MAX_DONE_SHOWN = 10;
			const recentDone = done.slice(-MAX_DONE_SHOWN).reverse();
			if (recentDone.length > 0) {
				this.container.createEl('p', {
					text: done.length > MAX_DONE_SHOWN
						? `Completed (${done.length} total, showing last ${MAX_DONE_SHOWN})`
						: 'Completed',
					cls: 'cf-section-label',
				});
				for (const task of recentDone) {
					this.renderDoneCard(list, task);
				}
			}

			if (allDone && allTasks.length > 0) {
				const doneCard = this.container.createDiv({ cls: 'cf-done-card' });
				doneCard.createEl('div', { text: '⭐', cls: 'cf-done-emoji' });
				doneCard.createEl('h2', { text: 'All checked off!', cls: 'cf-done-title' });
				doneCard.createEl('p', { text: 'Every chore done for the day.', cls: 'cf-muted' });
			}

			// Add button
			const actionRow = this.container.createDiv({ cls: 'cf-action-row' });
			const addBtn = actionRow.createEl('button', {
				text: '+ Add a chore',
				cls: 'cf-action-btn cf-dashed',
			});
			addBtn.addEventListener('click', () => this.showAddForm());
		})();
	}

	private renderTaskCard(container: HTMLElement, task: ParsedTask) {
		const card = container.createDiv({ cls: 'cf-card cf-chore-card' });
		if (task.title === this.selectedTaskTitle) card.addClass('cf-selected');

		const checkbox = card.createEl('input', { type: 'checkbox', cls: 'cf-checkbox' });
		checkbox.checked = task.completed;
		checkbox.addEventListener('change', () => this.toggleTask(task));

		const body = card.createDiv({ cls: 'cf-chore-body' });
		body.createEl('h3', { text: task.title });

		const meta = body.createDiv({ cls: 'cf-meta' });
		meta.createEl('span', { text: task.difficulty, cls: `cf-diff cf-diff-${task.difficulty}` });
		if (task.recurrence !== 'one-time') {
			meta.createEl('span', { text: task.recurrence, cls: 'cf-recurrence' });
		}
		if (task.dueDate) {
			meta.createEl('span', { text: task.dueDate, cls: 'cf-due' });
		}

		const editBtn = card.createEl('button', { text: '✎', cls: 'cf-icon-btn' });
		editBtn.addEventListener('click', () => this.editTask(task));

		if (task.title === this.selectedTaskTitle) {
			card.createEl('span', { text: 'Current', cls: 'cf-current-badge' });
		}
	}

	private renderInactiveCard(container: HTMLElement, task: ParsedTask) {
		const card = container.createDiv({ cls: 'cf-card cf-chore-card cf-inactive' });
		card.createEl('span', { text: '⏳', cls: 'cf-checkbox-placeholder' });
		const body = card.createDiv({ cls: 'cf-chore-body' });
		body.createEl('h3', { text: task.title });
		const meta = body.createDiv({ cls: 'cf-meta' });
		meta.createEl('span', { text: task.difficulty, cls: `cf-diff cf-diff-${task.difficulty}` });
		if (task.recurrence !== 'one-time') {
			meta.createEl('span', { text: task.recurrence, cls: 'cf-recurrence' });
		}
		meta.createEl('span', { text: `Starts ${task.dueDate}`, cls: 'cf-due' });
	}

	private renderDoneCard(container: HTMLElement, task: ParsedTask) {
		const card = container.createDiv({ cls: 'cf-card cf-chore-card cf-done' });
		card.createEl('span', { text: '✓', cls: 'cf-checkbox-placeholder' });
		const body = card.createDiv({ cls: 'cf-chore-body' });
		const title = body.createEl('h3', { text: task.title });
		title.addClass('cf-strikethrough');
		const meta = body.createDiv({ cls: 'cf-meta' });
		meta.createEl('span', { text: task.difficulty, cls: `cf-diff cf-diff-${task.difficulty}` });
	}

	private async toggleTask(task: ParsedTask) {
		if (task.completed) {
			// Uncheck: [x] -> [ ]
			const newLine = buildTaskLine(task.title, false, task.difficulty, task.recurrence, task.dueDate);
			await this.replaceFileLine(task.originalLine, newLine);
		} else {
			// Check: [ ] -> [x]
			const newLine = buildTaskLine(task.title, true, task.difficulty, task.recurrence, task.dueDate);
			await this.replaceFileLine(task.originalLine, newLine);

			if (task.recurrence !== 'one-time') {
				const today = new Date();
				let nextDue: Date;
				if (task.recurrence === 'weekly') {
					nextDue = new Date(today);
					nextDue.setDate(today.getDate() + 7);
				} else if (task.recurrence === 'monthly') {
					nextDue = new Date(today);
					nextDue.setMonth(today.getMonth() + 1);
				} else {
					nextDue = new Date(today);
					nextDue.setFullYear(today.getFullYear() + 1);
				}
				const nextLine = buildTaskLine(task.title, false, task.difficulty, task.recurrence, nextDue.toISOString().slice(0, 10));
				await this.appendFileLine(nextLine);
			}
		}

		this.selectedTaskTitle = null;
		this.render();
	}

	private async spin(slotArea: HTMLElement, btn: HTMLButtonElement) {
		const allTasks = await this.readSourceTasks();
		const today = this.todayStr();
		const available = allTasks.filter(t => !t.completed && (!t.dueDate || t.dueDate <= today));
		if (this.spinning || available.length === 0) return;

		this.spinning = true;
		btn.disabled = true;
		this.selectedTaskTitle = null;

		const target = available[Math.floor(Math.random() * available.length)];
		const display = slotArea.createEl('div', { text: '', cls: 'cf-slot-display' });

		const totalDuration = 1800 + Math.random() * 800;
		const start = performance.now();
		let cycleCount = 0;

		const animate = () => {
			const elapsed = performance.now() - start;
			if (elapsed >= totalDuration) {
				display.setText(target.title);
				display.addClass('cf-slot-landed');
				this.selectedTaskTitle = target.title;
				// Pause so the user can see the final result before re-rendering
				setTimeout(() => {
					this.spinning = false;
					btn.disabled = false;
					this.render();
				}, 600);
				return;
			}
			const progress = elapsed / totalDuration;
			const interval = 40 + Math.pow(progress, 2) * 360;
			display.setText(available[cycleCount % available.length].title);
			cycleCount++;
			setTimeout(animate, interval);
		};
		animate();
	}

	private showAddForm() {
		const modal = new AddChoreModal(this.app, async (title, difficulty, recurrence, dueDate) => {
			const line = buildTaskLine(title, false, difficulty, recurrence, dueDate);
			await this.appendFileLine(line);
			this.render();
		});
		modal.open();
	}

	private editTask(task: ParsedTask) {
		const modal = new EditChoreModal(this.app, task, async (newTask) => {
			const newLine = buildTaskLine(newTask.title, newTask.completed, newTask.difficulty, newTask.recurrence, newTask.dueDate);
			await this.replaceFileLine(task.originalLine, newLine);
			this.render();
		}, async () => {
			await this.replaceFileLine(task.originalLine, null);
			this.render();
		});
		modal.open();
	}

	private showLinkFileModal() {
		new LinkFileModal(this.app, this.data, async (path) => {
			this.data.sourceFile = path;
			await this.persist();
			this.render();
		}).open();
	}

	private async performSync() {
		if (!this.data.sourceFile || !this.data.syncId) return;
		new Notice('Syncing...', 2000);
		try {
			const file = this.app.vault.getAbstractFileByPath(this.data.sourceFile);
			if (!file || !(file instanceof TFile)) return;
			const markdown = await this.app.vault.read(file);

			const res = await fetch(`${this.data.serverUrl}/api/sync/${this.data.syncId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ markdown }),
			});

			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const result = await res.json() as { markdown: string; appliedCompletions: number };

			if (result.appliedCompletions > 0) {
				await this.app.vault.modify(file, result.markdown);
				new Notice(`Synced! ${result.appliedCompletions} completion(s) applied from web.`, 3000);
			} else {
				new Notice('Synced! No web changes to apply.', 2000);
			}
			this.render();
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			new Notice(`Sync failed: ${msg}`, 4000);
		}
	}

}

class AddChoreModal extends Modal {
	private onAdd: (title: string, difficulty: string, recurrence: string, dueDate: string | null) => void;

	constructor(app: any, onAdd: (title: string, difficulty: string, recurrence: string, dueDate: string | null) => void) {
		super(app);
		this.onAdd = onAdd;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Add Chore' });

		let title = '';
		let difficulty = 'medium';
		let recurrence = 'one-time';
		let dueDate = '';

		new Setting(contentEl).setName('Title').addText(t => {
			t.setPlaceholder('e.g. Mow the lawn');
			t.onChange(v => title = v);
		});
		new Setting(contentEl).setName('Difficulty').addDropdown(d => {
			d.addOption('easy', 'Easy');
			d.addOption('medium', 'Medium');
			d.addOption('hard', 'Hard');
			d.setValue('medium');
			d.onChange(v => difficulty = v);
		});
		new Setting(contentEl).setName('Repeats').addDropdown(d => {
			d.addOption('one-time', 'One-time');
			d.addOption('weekly', 'Weekly');
			d.addOption('monthly', 'Monthly');
			d.addOption('yearly', 'Yearly');
			d.setValue('one-time');
			d.onChange(v => recurrence = v);
		});
		new Setting(contentEl).setName('Due date').addText(t => {
			t.inputEl.type = 'date';
			t.onChange(v => dueDate = v);
		});

		new Setting(contentEl).addButton(btn => {
			btn.setButtonText('Add');
			btn.setCta();
			btn.onClick(async () => {
				if (!title.trim()) return;
				this.onAdd(title.trim(), difficulty, recurrence, dueDate || null);
				this.close();
			});
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}

class EditChoreModal extends Modal {
	private task: ParsedTask;
	private onSave: (task: ParsedTask) => void;
	private onDelete: () => void;

	constructor(app: any, task: ParsedTask, onSave: (task: ParsedTask) => void, onDelete: () => void) {
		super(app);
		this.task = task;
		this.onSave = onSave;
		this.onDelete = onDelete;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Edit Chore' });

		let title = this.task.title;
		let difficulty = this.task.difficulty;
		let recurrence = this.task.recurrence;
		let dueDate = this.task.dueDate ?? '';

		new Setting(contentEl).setName('Title').addText(t => {
			t.setValue(title);
			t.onChange(v => title = v);
		});
		new Setting(contentEl).setName('Difficulty').addDropdown(d => {
			d.addOption('easy', 'Easy');
			d.addOption('medium', 'Medium');
			d.addOption('hard', 'Hard');
			d.setValue(difficulty);
			d.onChange(v => difficulty = v as 'easy' | 'medium' | 'hard');
		});
		new Setting(contentEl).setName('Repeats').addDropdown(d => {
			d.addOption('one-time', 'One-time');
			d.addOption('weekly', 'Weekly');
			d.addOption('monthly', 'Monthly');
			d.addOption('yearly', 'Yearly');
			d.setValue(recurrence);
			d.onChange(v => recurrence = v as 'one-time' | 'weekly' | 'monthly' | 'yearly');
		});
		new Setting(contentEl).setName('Due date').addText(t => {
			t.inputEl.type = 'date';
			t.setValue(dueDate);
			t.onChange(v => dueDate = v);
		});

		new Setting(contentEl).addButton(btn => {
			btn.setButtonText('Save');
			btn.setCta();
			btn.onClick(async () => {
				if (!title.trim()) return;
				this.onSave({
					...this.task,
					title: title.trim(),
					difficulty,
					recurrence,
					dueDate: dueDate || null,
				});
				this.close();
			});
		});

		new Setting(contentEl).addButton(btn => {
			btn.setButtonText('Delete');
			btn.buttonEl.addClass('mod-warning');
			btn.onClick(async () => {
				this.onDelete();
				this.close();
			});
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}

class LinkFileModal extends Modal {
	private data: ChorefastData;
	private onLink: (path: string) => void;
	private selectedPath: string = '';

	constructor(app: any, data: ChorefastData, onLink: (path: string) => void) {
		super(app);
		this.data = data;
		this.onLink = onLink;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Link to File' });
		contentEl.createEl('p', { text: 'Search for a markdown file in your vault to use as your chore database.', cls: 'text-muted' });

		const allFiles = this.app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));

		const fileWrapper = contentEl.createDiv({ cls: 'cf-file-search' });
		const fileInput = fileWrapper.createEl('input', {
			cls: 'cf-file-input',
			attr: { placeholder: 'Search files...', type: 'text' },
		});
		const fileResults = fileWrapper.createDiv({ cls: 'cf-file-results' });

		const renderResults = (query: string) => {
			fileResults.empty();
			const q = query.toLowerCase().trim();
			const matches = q
				? allFiles.filter(f => f.path.toLowerCase().includes(q))
				: allFiles.slice(0, 8);
			for (const file of matches.slice(0, 8)) {
				const row = fileResults.createDiv({ cls: 'cf-file-result' });
				row.createEl('span', { text: file.path });
				if (this.selectedPath === file.path) {
					row.addClass('selected');
				}
				row.addEventListener('click', () => {
					this.selectedPath = file.path;
					fileInput.value = file.path;
					renderResults('');
				});
			}
			if (matches.length === 0) {
				fileResults.createEl('div', { cls: 'cf-file-empty', text: 'No files found' });
			}
		};

		fileInput.addEventListener('focus', () => renderResults(fileInput.value));
		fileInput.addEventListener('input', () => renderResults(fileInput.value));

		if (this.data.sourceFile) {
			fileInput.value = this.data.sourceFile;
			this.selectedPath = this.data.sourceFile;
		}

		new Setting(contentEl).addButton(btn => {
			btn.setButtonText('Link');
			btn.setCta();
			btn.onClick(async () => {
				if (!this.selectedPath) {
					new Notice('Please select a file.');
					return;
				}
				this.onLink(this.selectedPath);
				this.close();
			});
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}
