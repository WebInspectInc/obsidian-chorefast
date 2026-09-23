# Chorefast Obsidian Plugin

A Bases Kanban board that picks your next chore for you.

I stumbled across [Simone Giertz's chore chart](https://www.youtube.com/watch?v=pNfgQ-KqHR4) and wanted something similar, so I built this!

Chorefast adds a **Chorefast Kanban** view to [Bases](https://help.obsidian.md/bases). Use Obsidian's native kanban layout to organize chores by status, then switch to the Chorefast view to spin for a random task in any column and publish the whole board to the web.

## Requirements

- Obsidian **1.10.0+** (Bases view API).
- Obsidian **1.14.0+** if you want the native kanban layout for editing. Chorefast's own view works on 1.10+.

## Writing Chores

Each chore is a note. Add properties (frontmatter) to control how it appears:

```yaml
status: Todo          # column — group your Base by this property
difficulty: medium    # easy | medium | hard
due: 2024-12-25       # optional date
recurrence: weekly    # one-time | weekly | monthly | yearly
```

Example note body:

```markdown
Water the plants.
```

## Setting Up a Board

1. Create a new Base and add a **Kanban** view (Obsidian 1.14+), grouping by `status`.
2. Add a second view and choose **Chorefast Kanban** as the layout.
3. Optionally configure the view:
   - **Card title property** — show a property instead of the file name.
   - **Done column value** — the column that the random picker will skip (default `Done`).
   - **Show random pick buttons** — toggle the dice button on each column.

Use the native Kanban view to drag chores between columns; use the Chorefast view to hit the dice and pick a random chore from a column. Both views read the same notes.

## Web Sync Setup

1. Open [chore.fast/create-sync](https://chore.fast/create-sync) in your browser.
2. Click **Create Free Sync** to generate a Sync ID.
3. In Obsidian, go to **Settings → Community Plugins → Chorefast**.
4. Paste the Sync ID (and Sync Secret, if provided) into the settings.
5. Click the publish button in the Chorefast view (or run **Chorefast: Publish board to web**).
6. Visit the public URL on any device to view your board.

## Development

```sh
npm install
npm run dev      # Watch for changes and rebuild automatically
npm run build    # Type-check and build for production
```

The plugin is written in TypeScript and bundled with esbuild. `main.ts` is the entry point.

## License

MIT
