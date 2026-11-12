//! "Start with Windows" (autostart).
//!
//! Two mechanisms, picked at run time:
//! - Classic `.exe` (Inno Setup installer or loose exe): a value in
//!   `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, the same value the
//!   installer's "Start ConnectMouse when Windows starts" task writes.
//!   Settings → Apps → Startup (and Task Manager) can switch it off through
//!   `...\Explorer\StartupApproved\Run`; that is respected and cleared again
//!   when the user turns the option back on in our menu.
//! - MSIX / Microsoft Store: packaged apps ignore the Run key, so the manifest
//!   declares a `windows.startupTask` and we drive it with the WinRT
//!   `StartupTask` API. Windows decides the final state there: once the user
//!   disables the task in Settings, only Settings can enable it again.
//!
//! Everything above the `sys` module is plain Rust and unit-tested anywhere.

/// Run-key value name; must match `windows/installer/ConnectMouse.iss`.
pub const RUN_VALUE: &str = "ConnectMouse";
/// `TaskId` of the `windows.startupTask` in `packaging/AppxManifest.xml`.
pub const STARTUP_TASK_ID: &str = "ConnectMouseStartup";
/// Passed by the Run key: start the server and skip the first-run balloon.
pub const AUTOSTART_ARG: &str = "--autostart";

/// What the tray menu shows and allows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Status {
    /// Off; clicking turns it on.
    Off,
    /// On; clicking turns it off.
    On,
    /// Packaged app, switched off by the user in Settings → Apps → Startup.
    /// Only Settings can switch it back on, so clicking opens that page.
    DisabledByUser,
    /// Forced off by group policy; nothing to do.
    DisabledByPolicy,
    /// Forced on by group policy; nothing to do.
    EnabledByPolicy,
    /// The API failed (e.g. manifest without the startup task).
    Unavailable,
}

impl Status {
    pub fn checked(self) -> bool {
        matches!(self, Status::On | Status::EnabledByPolicy)
    }

    /// Whether the menu item can be clicked at all.
    pub fn enabled(self) -> bool {
        matches!(self, Status::Off | Status::On | Status::DisabledByUser)
    }

    /// Maps WinRT `StartupTaskState` values (0..=4).
    pub fn from_startup_task_state(state: i32) -> Status {
        match state {
            0 => Status::Off,
            1 => Status::DisabledByUser,
            2 => Status::On,
            3 => Status::DisabledByPolicy,
            4 => Status::EnabledByPolicy,
            _ => Status::Unavailable,
        }
    }

    /// Classic exe: the Run value exists and Settings has not disabled it.
    pub fn from_run_key(has_value: bool, approved: Option<&[u8]>) -> Status {
        if has_value && approved.is_none_or(startup_approved) {
            Status::On
        } else {
            Status::Off
        }
    }
}

/// `StartupApproved\Run` values are 12 bytes; an even first byte (0x02, 0x06)
/// means enabled, an odd one (0x03, 0x07) means disabled in Settings.
pub fn startup_approved(data: &[u8]) -> bool {
    data.first().is_none_or(|flag| flag & 1 == 0)
}

/// Data of the Run value: the quoted exe path plus [`AUTOSTART_ARG`].
pub fn run_command(exe: &str) -> String {
    format!("\"{exe}\" {AUTOSTART_ARG}")
}

/// Whether this launch came from the Run key (`--autostart`, any case).
pub fn launched_at_logon<I, S>(args: I) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter()
        .skip(1)
        .any(|arg| arg.as_ref().eq_ignore_ascii_case(AUTOSTART_ARG))
}

#[cfg(windows)]
pub use sys::*;

#[cfg(windows)]
mod sys {
    use std::ptr::null_mut;

    use windows::{
        ApplicationModel::{
            Activation::ActivationKind, AppInstance, StartupTask, StartupTaskState,
        },
        core::HSTRING,
    };
    use windows_sys::{
        Win32::{
            Foundation::{ERROR_INSUFFICIENT_BUFFER, ERROR_SUCCESS, MAX_PATH},
            Storage::Packaging::Appx::GetCurrentPackageFullName,
            System::{
                LibraryLoader::GetModuleFileNameW,
                Registry::{
                    HKEY_CURRENT_USER, REG_SZ, RRF_RT_REG_BINARY, RRF_RT_REG_SZ,
                    RegDeleteKeyValueW, RegGetValueW, RegSetKeyValueW,
                },
            },
        },
        core::w,
    };

    use super::{RUN_VALUE, STARTUP_TASK_ID, Status, run_command};

    const RUN_KEY: *const u16 = w!("Software\\Microsoft\\Windows\\CurrentVersion\\Run");
    const APPROVED_KEY: *const u16 =
        w!("Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run");

    fn wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain([0]).collect()
    }

    /// True when running from an MSIX package (Store or sideloaded).
    pub fn packaged() -> bool {
        let mut length = 0u32;
        // APPMODEL_ERROR_NO_PACKAGE (15700) for a plain exe.
        unsafe { GetCurrentPackageFullName(&mut length, null_mut()) == ERROR_INSUFFICIENT_BUFFER }
    }

    /// Packaged app started by its startup task at sign-in.
    pub fn activated_by_startup_task() -> bool {
        AppInstance::GetActivatedEventArgs()
            .and_then(|args| args.Kind())
            .is_ok_and(|kind| kind == ActivationKind::StartupTask)
    }

    fn startup_task() -> windows::core::Result<StartupTask> {
        StartupTask::GetAsync(&HSTRING::from(STARTUP_TASK_ID))?.get()
    }

    fn task_status(state: StartupTaskState) -> Status {
        Status::from_startup_task_state(state.0)
    }

    /// Current state, read fresh each time the menu opens (Settings may
    /// have changed it meanwhile).
    pub fn status() -> Status {
        if packaged() {
            return startup_task()
                .and_then(|task| task.State())
                .map_or(Status::Unavailable, task_status);
        }
        let approved = read_binary(APPROVED_KEY, RUN_VALUE);
        Status::from_run_key(
            read_string(RUN_KEY, RUN_VALUE).is_some(),
            approved.as_deref(),
        )
    }

    /// Turns autostart on or off and returns the resulting state.
    pub fn set(enable: bool) -> Status {
        if packaged() {
            let Ok(task) = startup_task() else {
                return Status::Unavailable;
            };
            if enable {
                // Desktop apps get no prompt: Disabled becomes Enabled, while
                // DisabledByUser/ByPolicy are returned unchanged.
                return task
                    .RequestEnableAsync()
                    .and_then(|operation| operation.get())
                    .map_or(Status::Unavailable, task_status);
            }
            let _ = task.Disable();
            return task.State().map_or(Status::Unavailable, task_status);
        }
        let name = wide(RUN_VALUE);
        unsafe {
            if enable {
                if let Some(exe) = current_exe() {
                    let data = wide(&run_command(&exe));
                    RegSetKeyValueW(
                        HKEY_CURRENT_USER,
                        RUN_KEY,
                        name.as_ptr(),
                        REG_SZ,
                        data.as_ptr().cast(),
                        (data.len() * 2) as u32,
                    );
                }
                // Re-enable after "Off" in Settings → Apps → Startup.
                RegDeleteKeyValueW(HKEY_CURRENT_USER, APPROVED_KEY, name.as_ptr());
            } else {
                RegDeleteKeyValueW(HKEY_CURRENT_USER, RUN_KEY, name.as_ptr());
            }
        }
        status()
    }

    fn current_exe() -> Option<String> {
        let mut buffer = vec![0u16; MAX_PATH as usize];
        loop {
            let length =
                unsafe { GetModuleFileNameW(null_mut(), buffer.as_mut_ptr(), buffer.len() as u32) }
                    as usize;
            if length == 0 {
                return None;
            }
            if length < buffer.len() {
                return Some(String::from_utf16_lossy(&buffer[..length]));
            }
            if buffer.len() >= 32_768 {
                return None;
            }
            buffer.resize(buffer.len() * 2, 0);
        }
    }

    fn read_value(key: *const u16, name: &str, flags: u32) -> Option<Vec<u8>> {
        let name = wide(name);
        let mut bytes = 0u32;
        let status = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                key,
                name.as_ptr(),
                flags,
                null_mut(),
                null_mut(),
                &mut bytes,
            )
        };
        if status != ERROR_SUCCESS {
            return None;
        }
        let mut data = vec![0u8; bytes as usize];
        let status = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                key,
                name.as_ptr(),
                flags,
                null_mut(),
                data.as_mut_ptr().cast(),
                &mut bytes,
            )
        };
        (status == ERROR_SUCCESS).then(|| {
            data.truncate(bytes as usize);
            data
        })
    }

    fn read_string(key: *const u16, name: &str) -> Option<String> {
        let data = read_value(key, name, RRF_RT_REG_SZ)?;
        let units: Vec<u16> = data
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| u16::from_le_bytes(*pair))
            .take_while(|unit| *unit != 0)
            .collect();
        Some(String::from_utf16_lossy(&units))
    }

    fn read_binary(key: *const u16, name: &str) -> Option<Vec<u8>> {
        read_value(key, name, RRF_RT_REG_BINARY)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn run_command_quotes_paths_with_spaces() {
        assert_eq!(
            run_command(
                r"C:\Users\Carlos Costa\AppData\Local\Programs\ConnectMouse\RemoteMouse.exe"
            ),
            r#""C:\Users\Carlos Costa\AppData\Local\Programs\ConnectMouse\RemoteMouse.exe" --autostart"#
        );
    }

    #[test]
    fn autostart_flag_is_detected_after_program_name_only() {
        assert!(launched_at_logon(["RemoteMouse.exe", "--autostart"]));
        assert!(launched_at_logon(["RemoteMouse.exe", "--AUTOSTART"]));
        assert!(!launched_at_logon(["RemoteMouse.exe"]));
        assert!(!launched_at_logon(["--autostart"]));
        assert!(!launched_at_logon(["RemoteMouse.exe", "--autostarted"]));
    }

    #[test]
    fn startup_task_states_map_to_menu_states() {
        let cases = [
            (0, Status::Off, false, true),
            (1, Status::DisabledByUser, false, true),
            (2, Status::On, true, true),
            (3, Status::DisabledByPolicy, false, false),
            (4, Status::EnabledByPolicy, true, false),
            (9, Status::Unavailable, false, false),
        ];
        for (raw, status, checked, enabled) in cases {
            let mapped = Status::from_startup_task_state(raw);
            assert_eq!(mapped, status);
            assert_eq!(mapped.checked(), checked, "{status:?}");
            assert_eq!(mapped.enabled(), enabled, "{status:?}");
        }
    }

    #[test]
    fn run_key_respects_settings_startup_toggle() {
        let enabled = [0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        let disabled = [0x03, 0, 0, 0, 0x10, 0x20, 0, 0, 0, 0, 0, 0];
        assert_eq!(Status::from_run_key(false, None), Status::Off);
        assert_eq!(Status::from_run_key(true, None), Status::On);
        assert_eq!(Status::from_run_key(true, Some(&enabled)), Status::On);
        assert_eq!(Status::from_run_key(true, Some(&disabled)), Status::Off);
        assert_eq!(Status::from_run_key(true, Some(&[0x06])), Status::On);
        assert_eq!(Status::from_run_key(true, Some(&[0x07])), Status::Off);
        assert_eq!(Status::from_run_key(false, Some(&enabled)), Status::Off);
    }
}
