fn cleanup_legacy_service_worker() {
  #[cfg(windows)]
  {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
      let sw_dirs = [
        format!("{}\\com.expensetracker.desktop\\EBWebView\\Default\\Service Worker", local_app_data),
        format!("{}\\com.expensetracker.app\\EBWebView\\Default\\Service Worker", local_app_data),
      ];
      for dir in sw_dirs {
        let path = std::path::Path::new(&dir);
        if path.exists() {
          let _ = std::fs::remove_dir_all(path);
        }
      }
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  cleanup_legacy_service_worker();

  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}

