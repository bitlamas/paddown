# Paddown

A lightweight, project-oriented Markdown editor that renders with proper chat interface styling. Browse all your `.md` files, write and edit your notes, then paste into your LLM chat or terminal without any formatting surprises.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Download the latest version](https://github.com/bitlamas/paddown/releases/latest) (Windows and Ubuntu 24.04 confirmed working; macOS DMG built but untested)

![Paddown](screenshot.jpg)

## Why Paddown

I built this because I keep a lot of Markdown files around for projects using LLM and couldn't find an editor that wasn't either too heavy or too bare-bones.

**Project sidebar**: Pin folders and browse your `.md` files in a collapsible tree. Filesystem changes are watched in real-time, so it stays in sync without you doing anything.

**Lightweight**: Built on [Tauri v2](https://v2.tauri.app/) using the system's native WebView instead of bundling Chromium like Electron does. The portable exe is ~11 MB, the installer under 3 MB.

**Rendering**: The preview pane is modeled after Claude's chat interface -- similar typography, code blocks, spacing, the works.

## Features

- Split-pane live preview with drag-to-reorder tabs
- Formatting toolbar
- Scroll sync
- HTML and PDF export
- Autosave with crash recovery, atomic file writes
- Single-instance: double-clicking a `.md` file in your file manager opens it in the running window instead of spawning a second one
- Find & replace with in-editor match highlighting, syntax highlighting, dark mode, external file change detection, portable mode, auto-update checker
- Keyboard focus rings and `prefers-reduced-motion` support

## Platforms

| Platform | Format |
|---|---|
| Windows | NSIS installer + portable exe |
| Linux | AppImage (tested on Ubuntu 24.04) |
| macOS | DMG (built, not tested) |

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri v2](https://v2.tauri.app/) (Rust backend + system WebView) |
| Markdown parser | [marked.js](https://marked.js.org/) v4.3.0 (bundled locally) |
| Frontend | Vanilla HTML / CSS / JS |

No npm, no node_modules, no build step for the frontend.

## Building from Source

You'll need [Rust](https://rustup.rs/) and the [Tauri CLI](https://v2.tauri.app/).

```bash
cargo install tauri-cli --version "^2"
cd src-tauri
cargo tauri build
```

On Linux, you'll also need: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`.

## License

[MIT](LICENSE)