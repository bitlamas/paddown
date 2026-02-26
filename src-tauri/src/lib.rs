use std::path::Path;
use tauri::Manager;

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

// ─── Get App Version Command ────────────────────────────────

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// ─── App Setup ───────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            show_open_dialog,
            show_save_dialog,
            show_export_html_dialog,
            read_settings,
            write_settings,
            get_settings_path,
            get_cli_args,
            get_portable_settings_path,
            check_for_updates,
            get_app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Paddown");
}
