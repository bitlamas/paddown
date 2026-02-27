# Paddown

Markdown notepad that renders identically to Claude Desktop / claude.ai. Write notes offline, paste into Claude with zero formatting surprises.

## What it does

Paddown is a split-pane Markdown editor where the preview matches Claude's exact rendering — same fonts, spacing, code blocks, tables, and task lists. What you see in the preview is what you'll get when you paste into a Claude conversation.

## Features

- **Claude-identical preview** — CSS extracted from claude.ai, not approximated
- **Split / Editor / Preview** view modes (Ctrl+\\)
- **Tabbed editing** with drag-to-reorder
- **Syntax highlighting** in code blocks — JS, Python, HTML, CSS, Bash, JSON, SQL, PHP
- **Find & Replace** (Ctrl+F / Ctrl+H)
- **Formatting toolbar** — bold, italic, code, links
- **Right-click context menu** with formatting actions
- **File drag-and-drop** — drop .md/.txt files to open
- **Export to HTML** — standalone file with all styles inlined
- **Auto-update checker** via GitHub Releases
- **Portable mode** — settings file next to the exe, no install needed
- **Bidirectional scroll sync** — editor and preview stay in lockstep
- **CRLF/LF detection** — preserves original line endings on save

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 (Rust + system WebView) |
| Markdown parser | marked.js v4.3.0 (bundled locally) |
| Frontend | Vanilla HTML/CSS/JS — no frameworks, no bundler |
| Styling | Plain CSS with design tokens (`:root` variables) |
| Build | `cargo tauri build` — NSIS installer + portable exe |
| CI | GitHub Actions — Windows build on tag push |

No npm. No node_modules. No build step for the frontend.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+N | New tab |
| Ctrl+O | Open file |
| Ctrl+S | Save |
| Ctrl+Shift+S | Save As |
| Ctrl+W | Close tab |
| Ctrl+Tab | Next tab |
| Ctrl+Shift+Tab | Previous tab |
| Ctrl+\\ | Cycle view mode |
| Ctrl+F | Find |
| Ctrl+H | Find & Replace |
| Ctrl+B | Bold |
| Ctrl+I | Italic |
| Ctrl+K | Link |
| Ctrl+` | Inline code |
| Ctrl+=/- | Zoom in/out |
| Ctrl+0 | Reset zoom |

## Building from source

Requires [Rust](https://rustup.rs/) and [Tauri CLI v2](https://v2.tauri.app/).

```bash
cargo install tauri-cli --version "^2"
cd src-tauri
cargo tauri build
```

Output: `src-tauri/target/release/paddown.exe` (portable) and NSIS installer in `bundle/nsis/`.

## License

Private.
