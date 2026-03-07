# Paddown

A lightweight, project-oriented Markdown editor that renders with proper chat interface styling. See all Markdown files in your project easily; write and edit your notes and paste into your LLM chat or terminal with zero formatting surprises.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Download the latest version](https://github.com/bitlamas/paddown/releases/latest) (installer or portable).

![Paddown](screenshot.jpg)

## Why Paddown

**Project sidebar**: Pin project folders and browse your `.md` files in a collapsible tree view. Filesystem changes are watched in real-time. Great for organizing LLM-friendly projects where Markdown is the backbone.

**Lightweight**: Built on [Tauri v2](https://v2.tauri.app/) with the system's native WebView, not Electron. The portable exe is ~11 MB, the installer under 3 MB. Minimal memory footprint.

**Beautiful rendering**: Preview pane is inspired by Claude's chat interface: similar typography, code blocks, inline code styling, spacing.

## Features

Split-pane live preview, tabbed editing with drag-to-reorder, find & replace, formatting toolbar, syntax highlighting (8 languages), standalone HTML export, scroll sync, portable mode, auto-update checker, and all the standard features you'd expect from a text editor.

## Platforms

| Platform | Format |
|---|---|
| Windows | NSIS installer + portable exe |
| Linux | AppImage |
| macOS | DMG |

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri v2](https://v2.tauri.app/) (Rust backend + system WebView) |
| Markdown parser | [marked.js](https://marked.js.org/) v4.3.0 (bundled locally) |
| Frontend | Vanilla HTML / CSS / JS — no frameworks, no bundler |

No npm. No node_modules. No build step for the frontend.

## Building from Source

Requirements: [Rust](https://rustup.rs/) and the [Tauri CLI](https://v2.tauri.app/).

```bash
cargo install tauri-cli --version "^2"
cd src-tauri
cargo tauri build
```

## License

[MIT](LICENSE)
