# Paddown

A lightweight Markdown notepad with a professional chat-style preview. Write notes offline, paste anywhere with zero formatting surprises.

## Features

- **Split-pane editor** — write Markdown on the left, see the rendered preview on the right
- **Tabbed editing** with drag-to-reorder
- **Three view modes** — Split, Editor-only, Preview-only (Ctrl+\\)
- **Syntax highlighting** in code blocks — JS, Python, HTML, CSS, Bash, JSON, SQL, PHP
- **Find & Replace** (Ctrl+F / Ctrl+H)
- **Formatting toolbar** — bold, italic, code, links
- **Right-click context menu** with formatting actions
- **File drag-and-drop** — drop `.md` / `.txt` files to open
- **Export to standalone HTML** with all styles inlined
- **Bidirectional scroll sync** — editor and preview stay in lockstep
- **Auto-update checker** via GitHub Releases
- **Portable mode** — drop a settings file next to the exe, no install needed
- **CRLF/LF aware** — detects and preserves original line endings

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri v2](https://v2.tauri.app/) (Rust backend + system WebView) |
| Markdown parser | [marked.js](https://marked.js.org/) v4.3.0 (bundled locally) |
| Frontend | Vanilla HTML / CSS / JS — no frameworks, no bundler |
| Styling | Plain CSS with design tokens (`:root` variables) |
| Build | `cargo tauri build` — NSIS installer + portable exe |
| CI | GitHub Actions — Windows build on tag push |

No npm. No node_modules. No build step for the frontend.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+N | New tab |
| Ctrl+O | Open file |
| Ctrl+S | Save |
| Ctrl+Shift+S | Save As |
| Ctrl+W | Close tab |
| Ctrl+Tab / Ctrl+Shift+Tab | Next / Previous tab |
| Ctrl+\\ | Cycle view mode |
| Ctrl+F | Find |
| Ctrl+H | Find & Replace |
| Ctrl+B | Bold |
| Ctrl+I | Italic |
| Ctrl+K | Link |
| Ctrl+\` | Inline code |
| Ctrl+= / Ctrl+- | Zoom in / out |
| Ctrl+0 | Reset zoom |

## Building from Source

Requirements: [Rust](https://rustup.rs/) and [Tauri CLI v2](https://v2.tauri.app/).

```bash
cargo install tauri-cli --version "^2"
cd src-tauri
cargo tauri build
```

Outputs:
- **Portable exe** — `src-tauri/target/release/paddown.exe`
- **NSIS installer** — `src-tauri/target/release/bundle/nsis/Paddown_<version>_x64-setup.exe`
