use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Create the floating timer widget window
pub fn create_timer_widget(app: &AppHandle) -> Result<(), String> {
    let _window = WebviewWindowBuilder::new(
        app,
        "timer-widget",
        WebviewUrl::App("/timer-widget".into()),
    )
    .title("专注计时器")
    .inner_size(280.0, 120.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .transparent(true)
    .visible(true)
    .build()
    .map_err(|e| format!("Failed to create timer widget: {}", e))?;

    Ok(())
}

/// Create the floating todo list widget window
pub fn create_todo_widget(app: &AppHandle) -> Result<(), String> {
    let _window = WebviewWindowBuilder::new(
        app,
        "todo-widget",
        WebviewUrl::App("/todo-widget".into()),
    )
    .title("待办清单")
    .inner_size(320.0, 400.0)
    .resizable(true)
    .decorations(false)
    .always_on_top(true)
    .transparent(true)
    .visible(true)
    .build()
    .map_err(|e| format!("Failed to create todo widget: {}", e))?;

    Ok(())
}

/// Toggle timer widget visibility
#[tauri::command]
pub fn toggle_timer_widget(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("timer-widget") {
        let is_visible = window.is_visible()
            .map_err(|e| format!("Failed to check visibility: {}", e))?;
        
        if is_visible {
            window.hide()
                .map_err(|e| format!("Failed to hide window: {}", e))?;
        } else {
            window.show()
                .map_err(|e| format!("Failed to show window: {}", e))?;
        }
    } else {
        create_timer_widget(&app)?;
    }
    
    Ok(())
}

/// Toggle todo widget visibility
#[tauri::command]
pub fn toggle_todo_widget(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("todo-widget") {
        let is_visible = window.is_visible()
            .map_err(|e| format!("Failed to check visibility: {}", e))?;
        
        if is_visible {
            window.hide()
                .map_err(|e| format!("Failed to hide window: {}", e))?;
        } else {
            window.show()
                .map_err(|e| format!("Failed to show window: {}", e))?;
        }
    } else {
        create_todo_widget(&app)?;
    }
    
    Ok(())
}
