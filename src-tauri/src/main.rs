// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
mod single_instance {
    use std::sync::OnceLock;

    use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, ERROR_ALREADY_EXISTS};
    use windows_sys::Win32::System::Threading::CreateMutexW;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        FindWindowW, SetForegroundWindow, ShowWindow, SW_RESTORE, SW_SHOW,
    };

    const APP_MUTEX_NAME: &str = "Local\\FocusedMomentSingleton";
    const APP_WINDOW_TITLE: &str = "Focused Moment";

    static INSTANCE_GUARD: OnceLock<SingleInstanceGuard> = OnceLock::new();

    pub fn ensure_single_instance() -> bool {
        match SingleInstanceGuard::acquire(APP_MUTEX_NAME) {
            Some(guard) => {
                let _ = INSTANCE_GUARD.set(guard);
                true
            }
            None => {
                focus_existing_window(APP_WINDOW_TITLE);
                false
            }
        }
    }

    struct SingleInstanceGuard(isize);

    impl SingleInstanceGuard {
        fn acquire(name: &str) -> Option<Self> {
            let wide_name = to_wide(name);
            let handle = unsafe { CreateMutexW(std::ptr::null(), 0, wide_name.as_ptr()) };
            if handle.is_null() {
                return None;
            }

            let last_error = unsafe { GetLastError() };
            if last_error == ERROR_ALREADY_EXISTS {
                unsafe {
                    CloseHandle(handle);
                }
                None
            } else {
                Some(Self(handle as isize))
            }
        }
    }

    impl Drop for SingleInstanceGuard {
        fn drop(&mut self) {
            if self.0 != 0 {
                unsafe {
                    CloseHandle(self.0 as _);
                }
            }
        }
    }

    fn focus_existing_window(title: &str) {
        let wide_title = to_wide(title);
        let hwnd = unsafe { FindWindowW(std::ptr::null(), wide_title.as_ptr()) };
        if hwnd.is_null() {
            return;
        }

        unsafe {
            ShowWindow(hwnd, SW_SHOW);
            ShowWindow(hwnd, SW_RESTORE);
            SetForegroundWindow(hwnd);
        }
    }

    fn to_wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(std::iter::once(0)).collect()
    }
}

#[cfg(not(target_os = "windows"))]
mod single_instance {
    pub fn ensure_single_instance() -> bool {
        true
    }
}

fn main() {
    if !single_instance::ensure_single_instance() {
        return;
    }

    focused_moment_lib::run()
}
