# Chorefast Obsidian Plugin

A gamified chore picker that lives inside Obsidian. Link any markdown file as your chore database, randomly select your next task with a slot-machine animation, manage recurring chores, and optionally sync to the web for mobile access.

## Features

- **File as Database** — Your markdown file is the source of truth. Any `- [ ]` or `- [x]` task becomes a chore. Edit tasks in any editor, and Chorefast reads them live.
- **Bidirectional Sync** — Complete a task in Chorefast and the checkbox updates in your file. Check a box in your file and Chorefast reflects it automatically.
- **Slot Machine Picker** — Hit the dice button and let fate choose your next task with a satisfying animation.
- **Emoji Difficulties** — Mark tasks with 🟢 easy, 🟡 medium, or 🔴 hard. Readable in raw markdown, compatible with the Tasks plugin style.
- **Recurring Tasks** — Weekly, monthly, and yearly chores that respawn automatically. When you complete a recurring task, a new unchecked line is appended with the next due date.
- **Due Dates** — Schedule chores to appear only when they're relevant using `📅 YYYY-MM-DD`.
- **Web Sync (Optional)** — Create a sync ID at [chore.fast](https://chore.fast), check off tasks from your phone, and pull completions back into Obsidian.
- **Local & Private** — All data stays in your vault. No accounts, no tracking.

## Installation

### From GitHub Releases (Recommended)

1. Download the latest `main.js`, `manifest.json`, and `styles.css` from the [releases page](https://github.com/chorefast/obsidian-chorefast/releases).
2. Create a folder named `chorefast` in your vault's `.obsidian/plugins/` directory.
3. Copy the three files into that folder.
4. In Obsidian, go to **Settings → Community Plugins → Safe Mode** and turn it off.
5. Enable **Chorefast** in the installed plugins list.
6. Click the dice icon in the ribbon or run **"Open Chorefast"** from the command palette.
7. Click **"Link to file"** and choose a markdown file (or create a new one like `Chores.md`).

### Manual Build

```sh
git clone https://github.com/chorefast/obsidian-chorefast.git
cd obsidian-chorefast
npm install
npm run build
```

Then copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/chorefast/` folder.

## Writing Tasks

Use standard markdown task syntax. Add inline tags or emojis to set metadata:

- `🟢`, `🟡`, `🔴` — difficulty (easy, medium, hard)
- `#weekly`, `#monthly`, `#yearly` — recurrence
- `📅 YYYY-MM-DD` — due date

Example file:

```markdown
- [ ] Water plants 🟢
- [ ] Take out trash 🟡 #weekly
- [ ] Wash dishes 🔴 📅 2024-12-25
- [x] Call dentist 🟢
```

> **Note:** Emoji difficulties are the preferred format and are fully compatible with the Obsidian Tasks plugin. Hashtag difficulties (`#easy`, `#medium`, `#hard`) are still supported for backward compatibility.

## Web Sync Setup

1. Open [chore.fast/create-sync](https://chore.fast/create-sync) in your browser.
2. Click **Create Free Sync** to generate a Sync ID.
3. In Obsidian, go to **Settings → Community Plugins → Chorefast**.
4. Paste the Sync ID into the **Sync ID** field.
5. Click the 🔄 sync button in the Chorefast panel to push your tasks to the web.
6. Visit the public URL on any device to view and complete tasks.
7. Next time you sync in Obsidian, any web completions are pulled back into your file.

## Development

```sh
npm install
npm run dev      # Watch for changes and rebuild automatically
npm run build    # Type-check and build for production
```

The plugin is written in TypeScript and bundled with esbuild. `main.ts` is the entry point.

### Project Structure

```
.
├── main.ts              # Plugin entry point
├── manifest.json        # Obsidian plugin manifest
├── styles.css           # Plugin styles
├── esbuild.config.mjs   # Build configuration
├── tsconfig.json        # TypeScript configuration
└── src/
    ├── types.ts         # Shared types
    ├── data.ts          # Plugin data persistence
    ├── view.ts          # Main UI view (chore list, slot machine, modals)
    └── settings.ts      # Settings tab
```

## Compatibility

- **Minimum Obsidian version:** 0.15.0
- **Desktop & Mobile:** Works on both. The web sync feature lets you complete tasks on mobile even if you don't have the plugin installed there.

## License

MIT
