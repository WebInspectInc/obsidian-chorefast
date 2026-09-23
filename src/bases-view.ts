import { BasesView, Keymap, Notice, parsePropertyId, setIcon } from 'obsidian';
import type { BasesEntry, BasesEntryGroup, BasesPropertyId, HoverParent, HoverPopover, QueryController } from 'obsidian';
import type ChorefastPlugin from '../main';
import { buildBoard, getEntryTitle } from './board';
import { publishBoard } from './sync';

export const CHOREFAST_VIEW_TYPE = 'chorefast-kanban';

type DueStatus = 'overdue' | 'soon' | null;

export class ChorefastKanbanView extends BasesView implements HoverParent {
	readonly type = CHOREFAST_VIEW_TYPE;
	hoverPopover: HoverPopover | null = null;

	private plugin: ChorefastPlugin;
	private containerEl: HTMLElement;
	private selectedPath: string | null = null;
	private spinning = false;
	private spinTimer: number | null = null;
	private dragCard: HTMLElement | null = null;
	private dragColumn: HTMLElement | null = null;

	constructor(controller: QueryController, containerEl: HTMLElement, plugin: ChorefastPlugin) {
		super(controller);
		this.plugin = plugin;
		this.containerEl = containerEl.createDiv({ cls: 'cf-board' });
		this.containerEl.addEventListener('pointerdown', () => this.plugin.setActiveView(this));
		this.plugin.setActiveView(this);
	}

	onDataUpdated(): void {
		this.render();
	}

	onunload(): void {
		if (this.spinTimer !== null) window.clearTimeout(this.spinTimer);
		this.plugin.clearActiveView(this);
	}

	async publish(): Promise<void> {
		const data = this.plugin.getData();
		if (!data.syncId) {
			new Notice('Add a Sync ID in Settings → Chorefast to publish.', 5000);
			return;
		}
		new Notice('Publishing board...', 2000);
		try {
			const board = buildBoard(this.data, this.config);
			const { url } = await publishBoard(data, board);
			new Notice(`Board published: ${url}`, 6000);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			new Notice(`Publish failed: ${msg}`, 6000);
		}
	}

	private render(): void {
		this.containerEl.empty();

		const header = this.containerEl.createDiv({ cls: 'cf-board-header' });
		header.createDiv({ cls: 'cf-board-title', text: this.config.name || 'Chorefast' });
		const publishBtn = header.createEl('button', { cls: 'cf-icon-btn', attr: { title: 'Publish board to web' } });
		setIcon(publishBtn, 'upload-cloud');
		publishBtn.addEventListener('click', () => void this.publish());

		const groups = this.data.groupedData;
		const hasGrouping = groups.some(group => group.hasKey());

		if (!hasGrouping) {
			const message = groups.some(group => group.entries.length > 0)
				? 'Set the Base "Group by" to your status property to show columns.'
				: 'No chores found. Add notes with a status property to this Base.';
			this.containerEl.createDiv({ cls: 'cf-empty', text: message });
			return;
		}

		const showDice = this.config.get('showDice') !== false;
		const columnsEl = this.containerEl.createDiv({ cls: 'cf-columns' });
		for (const group of groups) {
			this.renderColumn(columnsEl, group, showDice);
		}
	}

	private renderColumn(parent: HTMLElement, group: BasesEntryGroup, showDice: boolean): void {
		const key = group.key?.toString() ?? 'None';
		const doneValue = String(this.config.get('doneValue') ?? 'Done');
		const isDone = doneValue.length > 0 && key.toLowerCase() === doneValue.toLowerCase();
		const enableReorder = this.config.get('enableReorder') !== false;

		const column = parent.createDiv({ cls: 'cf-column' });

		const head = column.createDiv({ cls: 'cf-column-head' });
		head.createEl('span', { cls: 'cf-column-name', text: key });
		head.createEl('span', { cls: 'cf-column-count', text: String(group.entries.length) });
		if (showDice) {
			const diceBtn = head.createEl('button', {
				cls: 'cf-icon-btn cf-dice-btn',
				attr: { title: 'Pick a random chore in this column' },
			});
			setIcon(diceBtn, 'dices');
			diceBtn.addEventListener('click', () => this.spin(column, group));
		}

		const body = column.createDiv({ cls: 'cf-column-body' });
		if (enableReorder) {
			body.addEventListener('dragover', (evt) => this.onDragOver(evt, body));
			body.addEventListener('drop', (evt) => {
				evt.preventDefault();
				void this.persistOrder(body);
			});
		}
		for (const entry of this.sortByOrder(group.entries)) {
			this.renderCard(body, entry, isDone, enableReorder);
		}
	}

	private renderCard(parent: HTMLElement, entry: BasesEntry, isDone: boolean, enableReorder: boolean): void {
		const card = parent.createDiv({ cls: 'cf-card' });
		card.dataset.path = entry.file.path;
		if (this.selectedPath === entry.file.path) card.addClass('cf-selected');

		if (!isDone) {
			const due = this.dueStatus(entry);
			if (due === 'overdue') {
				card.addClass('cf-due-overdue');
				card.setAttribute('title', 'Overdue');
			} else if (due === 'soon') {
				card.addClass('cf-due-soon');
				card.setAttribute('title', 'Due soon');
			}
		}

		if (enableReorder) {
			card.draggable = true;
			card.addEventListener('dragstart', (evt) => {
				this.dragCard = card;
				this.dragColumn = parent;
				card.addClass('cf-dragging');
				if (evt.dataTransfer) {
					evt.dataTransfer.setData('text/plain', entry.file.path);
					evt.dataTransfer.effectAllowed = 'move';
				}
			});
			card.addEventListener('dragend', () => {
				card.removeClass('cf-dragging');
				this.dragCard = null;
				this.dragColumn = null;
			});
		}

		const link = card.createEl('a', {
			cls: 'cf-card-title',
			text: getEntryTitle(entry, this.config),
			href: '#',
		});
		link.draggable = false;
		link.addEventListener('click', (evt) => {
			evt.preventDefault();
			const modEvent = Keymap.isModEvent(evt);
			void this.app.workspace.openLinkText(entry.file.path, '', modEvent);
		});
		link.addEventListener('mouseover', (evt) => {
			this.app.workspace.trigger('hover-link', {
				event: evt,
				source: 'chorefast',
				hoverParent: this,
				targetEl: link,
				linktext: entry.file.path,
			});
		});

		const titleProperty = this.config.getAsPropertyId('titleProperty');
		const meta = card.createDiv({ cls: 'cf-card-meta' });
		for (const propertyId of this.config.getOrder()) {
			if (propertyId === 'file.name' || propertyId === titleProperty) continue;
			const value = entry.getValue(propertyId);
			if (!value || !value.isTruthy()) continue;
			meta.createEl('span', { cls: 'cf-card-prop', text: value.toString() });
		}
	}

	private spin(column: HTMLElement, group: BasesEntryGroup): void {
		if (this.spinning) return;

		const doneValue = String(this.config.get('doneValue') ?? 'Done');
		const key = group.key?.toString() ?? '';
		if (doneValue && key.toLowerCase() === doneValue.toLowerCase()) {
			new Notice('This column is marked as done.');
			return;
		}

		const pool = group.entries;
		if (pool.length === 0) {
			new Notice('No chores in this column.');
			return;
		}

		this.spinning = true;
		this.selectedPath = null;
		const target = pool[Math.floor(Math.random() * pool.length)];
		const display = column.createDiv({ cls: 'cf-slot-display' });
		const totalDuration = 1200 + Math.random() * 600;
		const start = performance.now();
		let cycle = 0;

		const animate = () => {
			const elapsed = performance.now() - start;
			if (elapsed >= totalDuration) {
				display.setText(getEntryTitle(target, this.config));
				display.addClass('cf-slot-landed');
				this.selectedPath = target.file.path;
				this.spinning = false;
				this.spinTimer = window.setTimeout(() => {
					this.spinTimer = null;
					this.render();
					const selected = this.containerEl.querySelector('.cf-selected');
					selected?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
				}, 500);
				return;
			}
			const progress = elapsed / totalDuration;
			display.setText(getEntryTitle(pool[cycle % pool.length], this.config));
			cycle++;
			this.spinTimer = window.setTimeout(animate, 50 + Math.pow(progress, 2) * 300);
		};
		animate();
	}

	private dueStatus(entry: BasesEntry): DueStatus {
		const propertyId = this.config.getAsPropertyId('dueProperty') ?? 'note.due';
		const due = this.readDate(entry, propertyId);
		if (!due || Number.isNaN(due.getTime())) return null;

		const now = new Date();
		const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
		const days = Math.round((startOfDue - startOfToday) / 86_400_000);

		if (days < 0) return 'overdue';
		if (days <= this.warnDays()) return 'soon';
		return null;
	}

	private readDate(entry: BasesEntry, propertyId: BasesPropertyId): Date | null {
		const { type, name } = parsePropertyId(propertyId);
		if (type === 'note') {
			const raw = this.app.metadataCache.getFileCache(entry.file)?.frontmatter?.[name];
			const fromFrontmatter = this.toDate(raw);
			if (fromFrontmatter) return fromFrontmatter;
		}
		const value = entry.getValue(propertyId);
		if (value && value.isTruthy()) return this.toDate(value.toString());
		return null;
	}

	private toDate(raw: unknown): Date | null {
		if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
		if (typeof raw === 'number') {
			const date = new Date(raw);
			return Number.isNaN(date.getTime()) ? null : date;
		}
		if (typeof raw === 'string' && raw.trim()) {
			const date = new Date(raw);
			return Number.isNaN(date.getTime()) ? null : date;
		}
		return null;
	}

	private warnDays(): number {
		const value = Number(this.config.get('warnDays'));
		return Number.isFinite(value) ? Math.max(0, value) : 2;
	}

	private orderPropertyName(): string {
		const configured = this.config.get('orderProperty');
		if (typeof configured === 'string' && configured.trim()) return configured.trim();
		return 'kanban_order';
	}

	private readOrderValue(entry: BasesEntry): number | null {
		const raw = this.app.metadataCache.getFileCache(entry.file)?.frontmatter?.[this.orderPropertyName()];
		if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
		if (typeof raw === 'string' && raw.trim()) {
			const value = Number(raw);
			return Number.isFinite(value) ? value : null;
		}
		return null;
	}

	private sortByOrder(entries: BasesEntry[]): BasesEntry[] {
		const ranked = entries.map((entry, index) => ({ entry, index, order: this.readOrderValue(entry) }));
		if (ranked.every(item => item.order === null)) return entries;
		ranked.sort((a, b) => {
			if (a.order === null && b.order === null) return a.index - b.index;
			if (a.order === null) return 1;
			if (b.order === null) return -1;
			return a.order - b.order;
		});
		return ranked.map(item => item.entry);
	}

	private onDragOver(evt: DragEvent, body: HTMLElement): void {
		if (!this.dragCard || body !== this.dragColumn) return;
		evt.preventDefault();
		if (evt.dataTransfer) evt.dataTransfer.dropEffect = 'move';
		const after = this.getDragAfterElement(body, evt.clientY);
		if (after === null) body.appendChild(this.dragCard);
		else body.insertBefore(this.dragCard, after);
	}

	private getDragAfterElement(container: HTMLElement, y: number): HTMLElement | null {
		const cards = Array.from(container.querySelectorAll<HTMLElement>('.cf-card:not(.cf-dragging)'));
		let closest: { offset: number; element: HTMLElement | null } = { offset: Number.NEGATIVE_INFINITY, element: null };
		for (const card of cards) {
			const box = card.getBoundingClientRect();
			const offset = y - box.top - box.height / 2;
			if (offset < 0 && offset > closest.offset) closest = { offset, element: card };
		}
		return closest.element;
	}

	private async persistOrder(body: HTMLElement): Promise<void> {
		const orderProperty = this.orderPropertyName();
		const cards = Array.from(body.querySelectorAll<HTMLElement>('.cf-card'));
		try {
			await Promise.all(cards.map((card, index) => {
				const path = card.dataset.path;
				const file = path ? this.app.vault.getFileByPath(path) : null;
				if (!file) return Promise.resolve();
				return this.app.fileManager.processFrontMatter(file, (frontmatter) => {
					frontmatter[orderProperty] = index;
				});
			}));
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			new Notice(`Failed to save card order: ${msg}`, 4000);
		}
	}
}
