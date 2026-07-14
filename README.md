# Chorefast Obsidian Plugin

A simplified checklist plugin for Obsidian.

I stumbled across [Simone Giertz's chore chart](https://www.youtube.com/watch?v=pNfgQ-KqHR4) and wanted something similar, so I built this!

Currently only works on a single file (you choose which file), and gives you the ability to randomly select your next chore.

In my experience this greatly reduces the "barrier to entry" and allows me to knock out chores very rapidly.

## Installation

This plugin should be available in the community plugins list soon. Otherwise you can use BRAT or install manually.

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

## Compatibility

- **Minimum Obsidian version:** 0.15.0
- **Desktop & Mobile:** Works on both. The web sync feature lets you complete tasks on mobile even if you don't have the plugin installed there.

## License

MIT
