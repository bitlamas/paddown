use std::path::{Path, PathBuf};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::Manager;
use tauri::Emitter;
use notify::{Watcher, RecursiveMode, RecommendedWatcher};

/// Maximum file size we'll read (50MB)
const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;

// ─── File I/O Commands ───────────────────────────────────────

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let path = Path::new(&path);

    if !path.is_file() {
        return Err(format!("Not a file: {}", path.display()));
    }

    let metadata = std::fs::metadata(path)
        .map_err(|e| format!("Cannot read metadata for {}: {}", path.display(), e))?;

    if metadata.len() > MAX_FILE_SIZE {
        return Err(format!(
            "File too large ({:.1} MB, max {} MB)",
            metadata.len() as f64 / (1024.0 * 1024.0),
            MAX_FILE_SIZE / (1024 * 1024)
        ));
    }

    std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))
}

#[tauri::command]
fn write_file(path: String, contents: String) -> Result<(), String> {
    let path = Path::new(&path);

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            return Err(format!("Directory does not exist: {}", parent.display()));
        }
    }

    std::fs::write(path, contents)
        .map_err(|e| format!("Failed to write {}: {}", path.display(), e))
}

// ─── Dialog Commands ─────────────────────────────────────────

#[tauri::command]
fn show_open_dialog() -> Result<Option<String>, String> {
    let result = rfd::FileDialog::new()
        .add_filter("Markdown", &["md", "markdown"])
        .add_filter("Text", &["txt"])
        .add_filter("All Files", &["*"])
        .pick_file();

    Ok(result.map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
fn show_save_dialog(default_name: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new()
        .add_filter("Markdown", &["md", "markdown"])
        .add_filter("Text", &["txt"])
        .add_filter("All Files", &["*"]);

    if let Some(name) = default_name {
        dialog = dialog.set_file_name(&name);
    }

    let result = dialog.save_file();

    Ok(result.map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
fn show_export_html_dialog(default_name: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new()
        .add_filter("HTML", &["html", "htm"]);

    if let Some(name) = default_name {
        dialog = dialog.set_file_name(&name);
    }

    let result = dialog.save_file();
    Ok(result.map(|p| p.to_string_lossy().into_owned()))
}

// ─── Settings Commands ──────────────────────────────────────

#[tauri::command]
fn get_settings_path(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_config_dir()
        .map_err(|e| format!("Cannot resolve config dir: {}", e))?;

    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Cannot create config dir: {}", e))?;
    }

    let path = dir.join("settings.json");
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn read_settings(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app.path().app_config_dir()
        .map_err(|e| format!("Cannot resolve config dir: {}", e))?;

    let path = dir.join("settings.json");

    if !path.exists() {
        return Ok("{}".to_string());
    }

    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read settings: {}", e))
}

#[tauri::command]
fn write_settings(app: tauri::AppHandle, contents: String) -> Result<(), String> {
    let dir = app.path().app_config_dir()
        .map_err(|e| format!("Cannot resolve config dir: {}", e))?;

    if !dir.exists() {
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Cannot create config dir: {}", e))?;
    }

    let path = dir.join("settings.json");
    std::fs::write(&path, contents)
        .map_err(|e| format!("Failed to write settings: {}", e))
}

// ─── Portable Mode Detection ────────────────────────────────

/// Returns the path to a portable settings.json next to the exe, if it exists.
/// If it exists, the app should use it instead of the app config dir.
#[tauri::command]
fn get_portable_settings_path() -> Option<String> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let portable = dir.join("settings.json");
    if portable.exists() {
        Some(portable.to_string_lossy().into_owned())
    } else {
        None
    }
}

// ─── CLI Args Command ───────────────────────────────────────

#[tauri::command]
fn get_cli_args() -> Vec<String> {
    std::env::args().skip(1).collect()
}

// ─── Update Check Command ───────────────────────────────────

#[derive(serde::Serialize)]
struct UpdateInfo {
    version: String,
    url: String,
}

#[tauri::command]
fn check_for_updates(current_version: String) -> Result<Option<UpdateInfo>, String> {
    let resp: serde_json::Value = ureq::get(
        "https://api.github.com/repos/paddown/paddown/releases/latest"
    )
    .set("User-Agent", "Paddown-Update-Checker")
    .set("Accept", "application/vnd.github.v3+json")
    .call()
    .map_err(|e| format!("Network error: {}", e))?
    .into_json()
    .map_err(|e| format!("JSON parse error: {}", e))?;

    let tag = resp["tag_name"].as_str().unwrap_or("");
    let latest = tag.trim_start_matches('v');
    let current = current_version.trim_start_matches('v');

    if latest.is_empty() || latest == current {
        return Ok(None);
    }

    // Simple version comparison (semver-like)
    let latest_parts: Vec<u32> = latest.split('.').filter_map(|s| s.parse().ok()).collect();
    let current_parts: Vec<u32> = current.split('.').filter_map(|s| s.parse().ok()).collect();

    let is_newer = latest_parts.iter().zip(current_parts.iter())
        .find(|(a, b)| a != b)
        .map(|(a, b)| a > b)
        .unwrap_or(latest_parts.len() > current_parts.len());

    if is_newer {
        let url = resp["html_url"].as_str().unwrap_or("").to_string();
        Ok(Some(UpdateInfo {
            version: latest.to_string(),
            url,
        }))
    } else {
        Ok(None)
    }
}

// ─── Open URL in Default Browser ────────────────────────────

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Only http/https URLs are supported".to_string());
    }

    #[cfg(windows)]
    {
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &url])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    Ok(())
}

// ─── Get App Version Command ────────────────────────────────

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// ─── Sidebar: Folder Dialog ─────────────────────────────────

#[tauri::command]
fn show_folder_dialog() -> Result<Option<String>, String> {
    let result = rfd::FileDialog::new().pick_folder();
    Ok(result.map(|p| p.to_string_lossy().into_owned()))
}

// ─── Sidebar: Directory Scan ────────────────────────────────

#[derive(serde::Serialize, Clone)]
struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
    children: Vec<DirEntry>,
}

#[tauri::command]
fn scan_directory(path: String, extensions: Vec<String>) -> Result<Vec<DirEntry>, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("Directory not found: {}", path));
    }

    let exts_lower: Vec<String> = extensions.iter().map(|e| e.to_lowercase()).collect();

    const MAX_DEPTH: u32 = 20;
    const MAX_ENTRIES: usize = 10_000;

    struct Counter { count: usize }

    fn build_tree(dir: &Path, exts: &[String], depth: u32, counter: &mut Counter) -> Vec<DirEntry> {
        if depth > MAX_DEPTH || counter.count >= MAX_ENTRIES {
            return Vec::new();
        }

        let mut dirs: Vec<DirEntry> = Vec::new();
        let mut files: Vec<DirEntry> = Vec::new();

        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return Vec::new(),
        };

        for entry in entries.flatten() {
            if counter.count >= MAX_ENTRIES {
                break;
            }

            let name = entry.file_name().to_string_lossy().into_owned();

            // Skip hidden entries (Windows hidden attribute)
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if let Ok(meta) = entry.metadata() {
                    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
                    if meta.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0 {
                        continue;
                    }
                }
            }
            #[cfg(not(windows))]
            {
                if name.starts_with('.') {
                    continue;
                }
            }

            let file_type = match entry.file_type() {
                Ok(ft) => ft,
                Err(_) => continue,
            };

            // Skip symlinks to avoid cycles
            if file_type.is_symlink() {
                continue;
            }

            let path = entry.path();

            if file_type.is_dir() {
                let children = build_tree(&path, exts, depth + 1, counter);
                // Prune empty branches
                if !children.is_empty() {
                    counter.count += 1;
                    dirs.push(DirEntry {
                        name,
                        path: path.to_string_lossy().into_owned(),
                        is_dir: true,
                        children,
                    });
                }
            } else if file_type.is_file() {
                let ext = path.extension()
                    .map(|e| e.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                if exts.contains(&ext) {
                    counter.count += 1;
                    files.push(DirEntry {
                        name,
                        path: path.to_string_lossy().into_owned(),
                        is_dir: false,
                        children: Vec::new(),
                    });
                }
            }
        }

        // Sort: dirs first alphabetically, then files alphabetically
        dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        files.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        dirs.extend(files);
        dirs
    }

    let mut counter = Counter { count: 0 };
    Ok(build_tree(&root, &exts_lower, 0, &mut counter))
}

// ─── Sidebar: Reveal in Explorer ────────────────────────────

#[tauri::command]
fn reveal_in_explorer(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("Failed to reveal in explorer: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("Failed to reveal in Finder: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        let parent = p.parent()
            .map(|d| d.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.clone());
        std::process::Command::new("xdg-open")
            .arg(&parent)
            .spawn()
            .map_err(|e| format!("Failed to reveal in file manager: {}", e))?;
    }

    Ok(())
}

// ─── Sidebar: Filesystem Watching ───────────────────────────

struct WatcherState(Mutex<HashMap<String, RecommendedWatcher>>);

#[tauri::command]
fn start_watching(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let state = app.state::<WatcherState>();

    // Check if already watching (short lock)
    {
        let watchers = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
        if watchers.contains_key(&path) {
            return Ok(());
        }
    }

    let watch_path = path.clone();
    let app_handle = app.clone();

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<notify::Event, notify::Error>| {
            if res.is_ok() {
                let _ = app_handle.emit("fs-change", &watch_path);
            }
        },
        notify::Config::default(),
    ).map_err(|e| format!("Failed to create watcher: {}", e))?;

    watcher.watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch {}: {}", path, e))?;

    let mut watchers = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    watchers.insert(path, watcher);
    Ok(())
}

#[tauri::command]
fn stop_watching(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let state = app.state::<WatcherState>();
    let mut watchers = state.0.lock().map_err(|e| format!("Lock error: {}", e))?;
    if let Some(mut watcher) = watchers.remove(&path) {
        let _ = watcher.unwatch(Path::new(&path));
    }
    Ok(())
}

// ─── App Setup ───────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .manage(WatcherState(Mutex::new(HashMap::new())))
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            show_open_dialog,
            show_save_dialog,
            show_export_html_dialog,
            show_folder_dialog,
            scan_directory,
            reveal_in_explorer,
            start_watching,
            stop_watching,
            read_settings,
            write_settings,
            get_settings_path,
            get_cli_args,
            get_portable_settings_path,
            open_url,
            check_for_updates,
            get_app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Paddown");
}
