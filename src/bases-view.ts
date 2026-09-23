import { BasesView, Keymap, Notice, setIcon } from 'obsidian';
import type { BasesEntry, BasesEntryGroup, HoverParent, HoverPopover, QueryController } from 'obsidian';
import type ChorefastPlugin from '../main';
import { buildBoard, getEntryTitle } from './board';
import { publishBoard } from './sync';

export const CHOREFAST_VIEW_TYPE = 'chorefast-kanban';

export class ChorefastKanbanView extends BasesView implements HoverParent {
	readonly type = CHOREFAST_VIEW_TYPE;
	hoverPopover: HoverPopover | null = null;

	private plugin: ChorefastPlugin;
	private containerEl: HTMLElement;
	private selectedPath: string | null = null;
	private spinning = false;
	private spinTimer: number | null = null;

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
		const column = parent.createDiv({ cls: 'cf-column' });

		const head = column.createDiv({ cls: 'cf-column-head' });
		head.createEl('span', { cls: 'cf-column-name', text: group.key?.toString() ?? 'None' });
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
		for (const entry of group.entries) {
			this.renderCard(body, entry);
		}
	}

	private renderCard(parent: HTMLElement, entry: BasesEntry): void {
		const card = parent.createDiv({ cls: 'cf-card' });
		if (this.selectedPath === entry.file.path) card.addClass('cf-selected');

		const link = card.createEl('a', {
			cls: 'cf-card-title',
			text: getEntryTitle(entry, this.config),
			href: '#',
		});
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
}
