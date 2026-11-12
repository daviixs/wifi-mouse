//! Win32 front end: notification-area icon, right-click menu and a borderless
//! popup panel painted with GDI to mirror the macOS menu bar popover.
//!
//! Threading: everything here runs on the UI thread. The server thread only
//! pushes [`AgentMessage`]s into [`INBOX`] and wakes us with `WM_AGENT`.
//! Re-entrancy: Win32 calls that may send messages back to our window
//! procedure are never made while [`APP`] is borrowed.

use std::{
    cell::{Cell, RefCell},
    collections::{HashMap, VecDeque},
    mem::{size_of, zeroed},
    ptr::{null, null_mut},
    sync::{
        Mutex,
        atomic::{AtomicUsize, Ordering},
    },
};

use windows_sys::{
    Win32::{
        Foundation::*,
        Globalization::GetUserDefaultLocaleName,
        Graphics::{Dwm::DwmSetWindowAttribute, Gdi::*},
        System::{
            DataExchange::{CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData},
            LibraryLoader::GetModuleHandleW,
            Memory::{GMEM_MOVEABLE, GlobalAlloc, GlobalLock, GlobalUnlock},
            Ole::CF_UNICODETEXT,
            Registry::{HKEY_CURRENT_USER, REG_SZ, RRF_RT_REG_SZ, RegGetValueW, RegSetKeyValueW},
            SystemInformation::GetTickCount64,
            Threading::CreateMutexW,
        },
        UI::{
            Controls::{DRAWITEMSTRUCT, ODS_DISABLED, ODS_FOCUS, ODS_SELECTED},
            HiDpi::{GetDpiForMonitor, MDT_EFFECTIVE_DPI},
            Input::KeyboardAndMouse::{EnableWindow, IsWindowEnabled, SetFocus},
            Shell::*,
            WindowsAndMessaging::*,
        },
    },
    core::w,
};

use crate::{
    agent::{self, AgentHandle},
    autostart,
    l10n::{Lang, Strings},
    model::{AgentMessage, State},
};

const CLASS_NAME: *const u16 = w!("RemoteMouseTrayPopup");
const WM_TRAY: u32 = WM_APP + 1;
const WM_AGENT: u32 = WM_APP + 2;
/// Sent by a second launch so the running copy opens its panel instead.
const WM_SHOW_PANEL: u32 = WM_APP + 3;
/// Quit cleanly (server stopped, tray icon removed). Posted by the Inno Setup
/// installer/uninstaller (`windows/installer/ConnectMouse.iss`): keep the value.
const WM_QUIT_APP: u32 = WM_APP + 4;
const TRAY_ID: u32 = 1;
/// NIN_SELECT | NINF_KEY: Enter/Space on the focused notification icon.
const NIN_KEYSELECT: u32 = NIN_SELECT | 1;

const ID_LANGUAGE: i32 = 101;
const ID_FIREWALL: i32 = 102;
const ID_COPY: i32 = 103;
const ID_NETWORK: i32 = 104;
const ID_TOGGLE: i32 = 105;
const ID_QUIT: i32 = 106;
const BUTTON_IDS: [i32; 6] = [
    ID_LANGUAGE,
    ID_FIREWALL,
    ID_COPY,
    ID_NETWORK,
    ID_TOGGLE,
    ID_QUIT,
];

const MENU_OPEN: usize = 201;
const MENU_TOGGLE: usize = 202;
const MENU_QUIT: usize = 203;
const MENU_AUTOSTART: usize = 204;
const MENU_LANGUAGE: usize = 210; // + index in Lang::ALL

const TIMER_COPIED: usize = 1;
const TIMER_QUIT: usize = 2;
const TIMER_ADDRESSES: usize = 3;

const REG_KEY: *const u16 = w!("Software\\RemoteMouse");

/// Logical (96 DPI) width of the panel, close to the 380 pt macOS popover.
const WIDTH: i32 = 360;
const PAD: i32 = 20;

// Palette taken from macos/.../ServerPanel.swift (Theme), flattened for GDI.
const TEXT: COLORREF = rgb(245, 247, 255);
const MUTED: COLORREF = rgb(168, 181, 230);
const BLUE: COLORREF = rgb(61, 122, 255);
const CYAN: COLORREF = rgb(64, 214, 255);
const GREEN: COLORREF = rgb(46, 209, 122);
const BORDER: COLORREF = rgb(66, 80, 150);
const BG_TOP: COLORREF = rgb(10, 26, 107);
const BG_BOTTOM: COLORREF = rgb(5, 10, 43);
const CARD_TOP: COLORREF = rgb(28, 44, 136);
const CARD_BOTTOM: COLORREF = rgb(15, 21, 70);
const PRIMARY_LEFT: COLORREF = rgb(26, 77, 179);
const PRIMARY_RIGHT: COLORREF = rgb(64, 46, 158);

// Segoe MDL2 Assets glyphs (present on Windows 10 and 11).
const GLYPH_MOUSE: u16 = 0xE962;
const GLYPH_LAPTOP: u16 = 0xE7F8;
const GLYPH_WIFI: u16 = 0xE701;
const GLYPH_COPY: u16 = 0xE8C8;
const GLYPH_CHECK: u16 = 0xE73E;
const GLYPH_POWER: u16 = 0xE7E8;
const GLYPH_STOP: u16 = 0xE71A;
const GLYPH_GLOBE: u16 = 0xE774;
const GLYPH_SHIELD: u16 = 0xEA18;

const fn rgb(r: u8, g: u8, b: u8) -> COLORREF {
    r as u32 | (g as u32) << 8 | (b as u32) << 16
}

static INBOX: Mutex<VecDeque<AgentMessage>> = Mutex::new(VecDeque::new());
static PANEL: AtomicUsize = AtomicUsize::new(0);

thread_local! {
    static APP: RefCell<Option<App>> = const { RefCell::new(None) };
    /// Outside `APP`: WM_ACTIVATE arrives re-entrantly during ShowWindow.
    static HIDDEN_AT: Cell<u64> = const { Cell::new(0) };
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
enum Font {
    Brand,
    Title,
    Body,
    Small,
    Tiny,
    Strong,
    Mono,
    Button,
    ButtonStrong,
    Icon,
    IconSmall,
    IconHero,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Style {
    Primary,
    Secondary,
    Link,
    Chip,
}

struct ButtonSpec {
    style: Style,
    glyph: Option<u16>,
    label: String,
    enabled: bool,
    rect: RECT,
    /// Gradient behind the button (top, bottom) when it sits inside a card.
    backdrop: Option<(COLORREF, COLORREF)>,
}

enum Op {
    Card(RECT),
    Logo(RECT),
    Text {
        rect: RECT,
        text: Vec<u16>,
        font: Font,
        color: COLORREF,
        format: DRAW_TEXT_FORMAT,
    },
    Dot(RECT, COLORREF),
}

struct App {
    hwnd: HWND,
    icon: HICON,
    taskbar_created: u32,
    lang: Lang,
    state: State,
    agent: Option<AgentHandle>,
    quitting: bool,
    dpi: u32,
    fonts: HashMap<Font, HFONT>,
    buttons: HashMap<i32, ButtonSpec>,
    ops: Vec<Op>,
    size: (i32, i32),
}

pub fn run() {
    // Started at sign-in by the Run key (`--autostart`) or the MSIX startup
    // task: go straight to the tray with the server on, no first-run balloon.
    let at_logon = autostart::launched_at_logon(std::env::args())
        || (autostart::packaged() && autostart::activated_by_startup_task());
    unsafe {
        let instance = GetModuleHandleW(null());
        // One copy per user session; a second launch opens the existing panel.
        let _single = CreateMutexW(null(), 1, w!("Local\\RemoteMouse.SingleInstance"));
        if GetLastError() == ERROR_ALREADY_EXISTS {
            let existing = FindWindowW(CLASS_NAME, null());
            if !existing.is_null() && !at_logon {
                // Let the running copy take the foreground to show its panel.
                AllowSetForegroundWindow(ASFW_ANY);
                PostMessageW(existing, WM_SHOW_PANEL, 0, 0);
            }
            return;
        }

        let class = WNDCLASSEXW {
            cbSize: size_of::<WNDCLASSEXW>() as u32,
            style: CS_DROPSHADOW,
            lpfnWndProc: Some(window_proc),
            hInstance: instance,
            hCursor: LoadCursorW(null_mut(), IDC_ARROW),
            lpszClassName: CLASS_NAME,
            ..zeroed()
        };
        RegisterClassExW(&class);
        let hwnd = CreateWindowExW(
            WS_EX_TOOLWINDOW | WS_EX_TOPMOST | WS_EX_CONTROLPARENT,
            CLASS_NAME,
            w!("Remote Mouse"),
            WS_POPUP | WS_CLIPCHILDREN,
            0,
            0,
            WIDTH,
            600,
            null_mut(),
            null_mut(),
            instance,
            null(),
        );
        if hwnd.is_null() {
            return;
        }
        PANEL.store(hwnd as usize, Ordering::SeqCst);
        // Windows 11 rounded corners; ignored on Windows 10.
        let round: i32 = 2; // DWMWCP_ROUND
        DwmSetWindowAttribute(hwnd, 33, (&raw const round).cast(), 4);

        for id in BUTTON_IDS {
            CreateWindowExW(
                0,
                w!("BUTTON"),
                w!(""),
                WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_OWNERDRAW as u32,
                0,
                0,
                10,
                10,
                hwnd,
                id as isize as HMENU,
                instance,
                null(),
            );
        }

        let icon = LoadImageW(
            instance,
            // MAKEINTRESOURCEW(1)
            std::ptr::without_provenance::<u16>(1),
            IMAGE_ICON,
            GetSystemMetrics(SM_CXSMICON),
            GetSystemMetrics(SM_CYSMICON),
            LR_DEFAULTCOLOR,
        ) as HICON;
        let app = App {
            hwnd,
            icon,
            taskbar_created: RegisterWindowMessageW(w!("TaskbarCreated")),
            lang: initial_language(),
            state: State::default(),
            agent: None,
            quitting: false,
            dpi: 96,
            fonts: HashMap::new(),
            buttons: HashMap::new(),
            ops: Vec::new(),
            size: (WIDTH, 600),
        };
        APP.with_borrow_mut(|slot| *slot = Some(app));
        refresh(hwnd);
        add_tray_icon(hwnd);
        if at_logon {
            start_server(hwnd);
            refresh(hwnd);
            update_tray_tip(hwnd);
        } else {
            welcome_once(hwnd);
        }
        SetTimer(hwnd, TIMER_ADDRESSES, 5000, None);

        let mut message: MSG = zeroed();
        while GetMessageW(&mut message, null_mut(), 0, 0) > 0 {
            // Tab/Shift+Tab, Space/Enter on buttons and Esc (IDCANCEL).
            if IsDialogMessageW(hwnd, &message) == 0 {
                TranslateMessage(&message);
                DispatchMessageW(&message);
            }
        }
        // Dropping App drops any AgentHandle, which also stops the server.
        APP.with_borrow_mut(|slot| {
            if let Some(app) = slot.take() {
                for font in app.fonts.values() {
                    DeleteObject(*font);
                }
            }
        });
    }
}

fn with_app<R>(f: impl FnOnce(&mut App) -> R) -> Option<R> {
    APP.with(|cell| {
        let mut slot = cell.try_borrow_mut().ok()?;
        slot.as_mut().map(f)
    })
}

unsafe extern "system" fn window_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    unsafe {
        match msg {
            WM_TRAY => {
                match (lparam & 0xffff) as u32 {
                    NIN_SELECT | NIN_KEYSELECT => toggle_panel(hwnd),
                    WM_CONTEXTMENU => {
                        // NOTIFYICON_VERSION_4: wParam carries the anchor point.
                        let x = (wparam & 0xffff) as u16 as i16 as i32;
                        let y = ((wparam >> 16) & 0xffff) as u16 as i16 as i32;
                        show_menu(hwnd, x, y);
                    }
                    _ => {}
                }
                0
            }
            WM_AGENT => {
                drain_agent(hwnd);
                0
            }
            WM_SHOW_PANEL => {
                show_panel(hwnd);
                0
            }
            WM_QUIT_APP => {
                quit(hwnd);
                0
            }
            WM_COMMAND => {
                // BN_CLICKED (0) only: owner-drawn buttons also report
                // BN_DOUBLECLICKED, which must not toggle the server twice.
                if (wparam >> 16) & 0xffff == 0 {
                    command(hwnd, (wparam & 0xffff) as i32);
                }
                0
            }
            WM_ACTIVATE => {
                // Transient like NSPopover: clicking anywhere else closes it.
                if (wparam & 0xffff) as u32 == WA_INACTIVE {
                    hide_panel(hwnd);
                }
                0
            }
            WM_ACTIVATEAPP => {
                if wparam == 0 {
                    hide_panel(hwnd);
                }
                0
            }
            WM_TIMER => {
                timer(hwnd, wparam);
                0
            }
            WM_DPICHANGED => {
                let dpi = (wparam & 0xffff) as u32;
                let changed = with_app(|app| app.dpi != dpi).unwrap_or(false);
                if changed {
                    set_dpi(dpi);
                    refresh(hwnd);
                }
                0
            }
            WM_ERASEBKGND => 1,
            WM_PAINT => {
                paint(hwnd);
                0
            }
            WM_DRAWITEM => {
                draw_button(&*(lparam as *const DRAWITEMSTRUCT));
                1
            }
            WM_CLOSE => {
                hide_panel(hwnd);
                0
            }
            WM_ENDSESSION => {
                if wparam != 0 {
                    if lparam as u32 & ENDSESSION_CLOSEAPP != 0 {
                        // Restart Manager (installer/updater) asks us to exit;
                        // the session itself keeps running.
                        quit(hwnd);
                    } else {
                        remove_tray_icon(hwnd);
                        stop_server();
                    }
                }
                0
            }
            WM_DESTROY => {
                remove_tray_icon(hwnd);
                PostQuitMessage(0);
                0
            }
            _ => {
                let recreate = with_app(|app| app.taskbar_created == msg).unwrap_or(false);
                if recreate && msg != 0 {
                    // Explorer restarted: the old icon is gone.
                    add_tray_icon(hwnd);
                    return 0;
                }
                DefWindowProcW(hwnd, msg, wparam, lparam)
            }
        }
    }
}

// ---------------------------------------------------------------- actions

fn command(hwnd: HWND, id: i32) {
    match id {
        ID_TOGGLE => toggle_server(hwnd),
        ID_COPY => copy_address(hwnd),
        ID_NETWORK => open(w!("ms-settings:network-status"), null()),
        ID_FIREWALL => open(
            w!("control.exe"),
            w!("/name Microsoft.WindowsFirewall /page pageConfigureApps"),
        ),
        ID_LANGUAGE => {
            if let Some(lang) = with_app(|app| app.lang.next()) {
                set_language(hwnd, lang);
            }
        }
        ID_QUIT => quit(hwnd),
        2 /* IDCANCEL: Esc */ => hide_panel(hwnd),
        _ => {}
    }
}

fn toggle_server(hwnd: HWND) {
    let running = with_app(|app| app.agent.is_some()).unwrap_or(false);
    if running {
        stop_server();
    } else {
        start_server(hwnd);
    }
    refresh(hwnd);
}

fn start_server(hwnd: HWND) {
    let should_start = with_app(|app| !app.quitting && app.state.start()).unwrap_or(false);
    if !should_start {
        return;
    }
    let target = hwnd as usize;
    let spawned = AgentHandle::spawn(move |message| {
        if let Ok(mut inbox) = INBOX.lock() {
            inbox.push_back(message);
        }
        unsafe { PostMessageW(target as HWND, WM_AGENT, 0, 0) };
    });
    with_app(|app| match spawned {
        Ok(handle) => app.agent = Some(handle),
        Err(error) => app
            .state
            .apply(AgentMessage::Stopped(Some(crate::model::Failure::Other(
                error.to_string(),
            )))),
    });
}

fn toggle_autostart(current: autostart::Status) {
    match current {
        // Packaged app switched off by the user: Windows only lets the
        // user turn it back on, in Settings → Apps → Startup.
        autostart::Status::DisabledByUser => open(w!("ms-settings:startupapps"), null()),
        autostart::Status::Off | autostart::Status::On => {
            autostart::set(!current.checked());
        }
        _ => {}
    }
}

fn stop_server() {
    with_app(|app| {
        if app.state.stop()
            && let Some(agent) = app.agent.as_mut()
        {
            agent.request_stop();
        }
    });
}

fn drain_agent(hwnd: HWND) {
    let messages: Vec<AgentMessage> = match INBOX.lock() {
        Ok(mut inbox) => inbox.drain(..).collect(),
        Err(_) => return,
    };
    let mut finished = None;
    let mut destroy = false;
    with_app(|app| {
        for message in messages {
            if matches!(message, AgentMessage::Stopped(_)) {
                finished = app.agent.take();
            }
            app.state.apply(message);
        }
        destroy = app.quitting && app.agent.is_none();
    });
    if let Some(handle) = finished {
        handle.join(); // Stopped is the thread's last action; this is immediate.
    }
    if destroy {
        unsafe { DestroyWindow(hwnd) };
        return;
    }
    refresh(hwnd);
    update_tray_tip(hwnd);
}

fn quit(hwnd: HWND) {
    let wait = with_app(|app| {
        app.quitting = true;
        if app.agent.is_some() {
            app.state.stop();
            if let Some(agent) = app.agent.as_mut() {
                agent.request_stop();
            }
            true
        } else {
            false
        }
    })
    .unwrap_or(false);
    unsafe {
        if wait {
            // mDNS goodbye packets take up to ~2 s; never hang the quit.
            SetTimer(hwnd, TIMER_QUIT, 5000, None);
            refresh(hwnd);
        } else {
            DestroyWindow(hwnd);
        }
    }
}

fn timer(hwnd: HWND, id: usize) {
    match id {
        TIMER_COPIED => {
            unsafe { KillTimer(hwnd, TIMER_COPIED) };
            with_app(|app| app.state.copied = false);
            refresh(hwnd);
        }
        TIMER_QUIT => unsafe {
            DestroyWindow(hwnd);
        },
        TIMER_ADDRESSES => {
            let online = with_app(|app| app.state.online()).unwrap_or(false);
            if online {
                let addresses = agent::lan_addresses();
                if with_app(|app| app.state.update_addresses(addresses)).unwrap_or(false) {
                    refresh(hwnd);
                    update_tray_tip(hwnd);
                }
            }
        }
        _ => {}
    }
}

fn copy_address(hwnd: HWND) {
    let Some(address) = with_app(|app| app.state.address()).flatten() else {
        return;
    };
    let text: Vec<u16> = address.encode_utf16().chain([0]).collect();
    unsafe {
        if OpenClipboard(hwnd) == 0 {
            return;
        }
        EmptyClipboard();
        let bytes = text.len() * 2;
        let memory = GlobalAlloc(GMEM_MOVEABLE, bytes);
        let mut ok = false;
        if !memory.is_null() {
            let target = GlobalLock(memory) as *mut u16;
            if !target.is_null() {
                target.copy_from_nonoverlapping(text.as_ptr(), text.len());
                GlobalUnlock(memory);
                ok = !SetClipboardData(CF_UNICODETEXT as u32, memory as HANDLE).is_null();
            }
            if !ok {
                GlobalFree(memory);
            }
        }
        CloseClipboard();
        if ok {
            with_app(|app| app.state.copied = true);
            SetTimer(hwnd, TIMER_COPIED, 2000, None);
            refresh(hwnd);
        }
    }
}

fn open(file: *const u16, parameters: *const u16) {
    unsafe {
        ShellExecuteW(
            null_mut(),
            w!("open"),
            file,
            parameters,
            null(),
            SW_SHOWNORMAL,
        );
    }
}

fn set_language(hwnd: HWND, lang: Lang) {
    with_app(|app| app.lang = lang);
    let value: Vec<u16> = lang.tag().encode_utf16().chain([0]).collect();
    unsafe {
        RegSetKeyValueW(
            HKEY_CURRENT_USER,
            REG_KEY,
            w!("Language"),
            REG_SZ,
            value.as_ptr().cast(),
            (value.len() * 2) as u32,
        );
    }
    refresh(hwnd);
    update_tray_tip(hwnd);
}

fn initial_language() -> Lang {
    let saved = read_registry(w!("Language"));
    let mut locale = [0u16; 85];
    let length = unsafe { GetUserDefaultLocaleName(locale.as_mut_ptr(), locale.len() as i32) };
    let locale = String::from_utf16_lossy(&locale[..(length.max(1) - 1) as usize]);
    let ui = unsafe { windows_sys::Win32::Globalization::GetUserDefaultUILanguage() };
    Lang::resolve(saved.as_deref(), ui, &locale)
}

fn read_registry(name: *const u16) -> Option<String> {
    let mut buffer = [0u16; 64];
    let mut bytes = (buffer.len() * 2) as u32;
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            REG_KEY,
            name,
            RRF_RT_REG_SZ,
            null_mut(),
            buffer.as_mut_ptr().cast(),
            &mut bytes,
        )
    };
    if status != ERROR_SUCCESS {
        return None;
    }
    let length = buffer.iter().position(|c| *c == 0).unwrap_or(buffer.len());
    Some(String::from_utf16_lossy(&buffer[..length]))
}

// ---------------------------------------------------------------- tray

fn tray_data(hwnd: HWND) -> NOTIFYICONDATAW {
    let mut data: NOTIFYICONDATAW = unsafe { zeroed() };
    data.cbSize = size_of::<NOTIFYICONDATAW>() as u32;
    data.hWnd = hwnd;
    data.uID = TRAY_ID;
    data
}

fn copy_wide(target: &mut [u16], text: &str) {
    let limit = target.len() - 1;
    for (slot, unit) in target.iter_mut().zip(text.encode_utf16().take(limit)) {
        *slot = unit;
    }
}

fn add_tray_icon(hwnd: HWND) {
    let Some((icon, tip)) = with_app(|app| (app.icon, app.state.tooltip(app.lang.strings())))
    else {
        return;
    };
    let mut data = tray_data(hwnd);
    data.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP | NIF_SHOWTIP;
    data.uCallbackMessage = WM_TRAY;
    data.hIcon = icon;
    copy_wide(&mut data.szTip, &tip);
    unsafe {
        Shell_NotifyIconW(NIM_ADD, &data);
        data.Anonymous.uVersion = NOTIFYICON_VERSION_4;
        Shell_NotifyIconW(NIM_SETVERSION, &data);
    }
}

fn update_tray_tip(hwnd: HWND) {
    let Some(tip) = with_app(|app| app.state.tooltip(app.lang.strings())) else {
        return;
    };
    let mut data = tray_data(hwnd);
    data.uFlags = NIF_TIP | NIF_SHOWTIP;
    copy_wide(&mut data.szTip, &tip);
    unsafe { Shell_NotifyIconW(NIM_MODIFY, &data) };
}

fn remove_tray_icon(hwnd: HWND) {
    let data = tray_data(hwnd);
    unsafe { Shell_NotifyIconW(NIM_DELETE, &data) };
}

/// New icons land in the overflow on Windows 11; say where the app went.
fn welcome_once(hwnd: HWND) {
    if read_registry(w!("Welcomed")).is_some() {
        return;
    }
    let Some(body) = with_app(|app| app.lang.strings().welcome_body) else {
        return;
    };
    let mut data = tray_data(hwnd);
    data.uFlags = NIF_INFO;
    data.dwInfoFlags = NIIF_INFO | NIIF_RESPECT_QUIET_TIME;
    copy_wide(&mut data.szInfoTitle, "Remote Mouse");
    copy_wide(&mut data.szInfo, body);
    let one: Vec<u16> = "1".encode_utf16().chain([0]).collect();
    unsafe {
        Shell_NotifyIconW(NIM_MODIFY, &data);
        RegSetKeyValueW(
            HKEY_CURRENT_USER,
            REG_KEY,
            w!("Welcomed"),
            REG_SZ,
            one.as_ptr().cast(),
            4,
        );
    }
}

fn show_menu(hwnd: HWND, x: i32, y: i32) {
    hide_panel(hwnd);
    let Some((lang, running, busy)) =
        with_app(|app| (app.lang, app.agent.is_some(), app.state.busy()))
    else {
        return;
    };
    let s = lang.strings();
    // Read fresh: Settings → Apps → Startup may have changed it meanwhile.
    let startup = autostart::status();
    unsafe {
        let menu = CreatePopupMenu();
        let languages = CreatePopupMenu();
        for (index, option) in Lang::ALL.iter().enumerate() {
            let checked = if *option == lang {
                MF_CHECKED
            } else {
                MF_UNCHECKED
            };
            append(
                languages,
                MF_STRING | checked,
                MENU_LANGUAGE + index,
                option.native_name(),
            );
        }
        append(menu, MF_STRING, MENU_OPEN, s.button_open);
        let toggle = if running {
            s.button_stop
        } else {
            s.button_start
        };
        let grayed = if busy { MF_GRAYED } else { MF_ENABLED };
        append(menu, MF_STRING | grayed, MENU_TOGGLE, toggle);
        append(
            menu,
            MF_STRING | MF_POPUP,
            languages as usize,
            s.button_language,
        );
        if startup != autostart::Status::Unavailable {
            let mut flags = MF_STRING;
            flags |= if startup.checked() {
                MF_CHECKED
            } else {
                MF_UNCHECKED
            };
            flags |= if startup.enabled() {
                MF_ENABLED
            } else {
                MF_GRAYED
            };
            let label = if startup == autostart::Status::DisabledByUser {
                s.menu_autostart_settings
            } else {
                s.menu_autostart
            };
            append(menu, flags, MENU_AUTOSTART, label);
        }
        AppendMenuW(menu, MF_SEPARATOR, 0, null());
        append(menu, MF_STRING, MENU_QUIT, s.button_quit);
        SetMenuDefaultItem(menu, MENU_OPEN as u32, 0);
        // Required so the menu closes when the user clicks elsewhere.
        SetForegroundWindow(hwnd);
        let chosen = TrackPopupMenu(
            menu,
            TPM_RETURNCMD | TPM_NONOTIFY | TPM_RIGHTBUTTON | menu_alignment(),
            x,
            y,
            0,
            hwnd,
            null(),
        ) as usize;
        PostMessageW(hwnd, WM_NULL, 0, 0);
        DestroyMenu(menu); // also destroys the attached submenu
        match chosen {
            MENU_OPEN => show_panel(hwnd),
            MENU_TOGGLE => toggle_server(hwnd),
            MENU_QUIT => quit(hwnd),
            MENU_AUTOSTART => toggle_autostart(startup),
            index if (MENU_LANGUAGE..MENU_LANGUAGE + Lang::ALL.len()).contains(&index) => {
                set_language(hwnd, Lang::ALL[index - MENU_LANGUAGE]);
            }
            _ => {}
        }
    }
}

fn menu_alignment() -> TRACK_POPUP_MENU_FLAGS {
    unsafe {
        if GetSystemMetrics(SM_MENUDROPALIGNMENT) != 0 {
            TPM_RIGHTALIGN
        } else {
            TPM_LEFTALIGN
        }
    }
}

fn append(menu: HMENU, flags: MENU_ITEM_FLAGS, id: usize, text: &str) {
    let text: Vec<u16> = text.encode_utf16().chain([0]).collect();
    unsafe { AppendMenuW(menu, flags, id, text.as_ptr()) };
}

// ---------------------------------------------------------------- panel

fn toggle_panel(hwnd: HWND) {
    unsafe {
        if IsWindowVisible(hwnd) != 0 {
            hide_panel(hwnd);
        } else if GetTickCount64().saturating_sub(HIDDEN_AT.get()) > 300 {
            // Clicking the icon first deactivates (hides) the panel; do not
            // immediately reopen it on that same click.
            show_panel(hwnd);
        }
    }
}

fn hide_panel(hwnd: HWND) {
    unsafe {
        if IsWindowVisible(hwnd) != 0 {
            HIDDEN_AT.set(GetTickCount64());
            ShowWindow(hwnd, SW_HIDE);
        }
    }
}

fn show_panel(hwnd: HWND) {
    let (anchor, info, dpi) = anchor_monitor(hwnd);
    set_dpi(dpi);
    refresh(hwnd);
    place_panel(hwnd, anchor, &info, dpi, true);
    unsafe {
        SetForegroundWindow(hwnd);
        if let Some(toggle) = button(hwnd, ID_TOGGLE)
            && IsWindowEnabled(toggle) != 0
        {
            SetFocus(toggle);
        }
    }
}

/// The notification icon (or the cursor when it sits in the overflow) and
/// the monitor it is on, with that monitor's effective DPI.
fn anchor_monitor(hwnd: HWND) -> (RECT, MONITORINFO, u32) {
    unsafe {
        let mut anchor: RECT = zeroed();
        let identifier = NOTIFYICONIDENTIFIER {
            cbSize: size_of::<NOTIFYICONIDENTIFIER>() as u32,
            hWnd: hwnd,
            uID: TRAY_ID,
            ..zeroed()
        };
        if Shell_NotifyIconGetRect(&identifier, &mut anchor) < 0 {
            let mut cursor: POINT = zeroed();
            GetCursorPos(&mut cursor);
            anchor = RECT {
                left: cursor.x,
                top: cursor.y,
                right: cursor.x + 1,
                bottom: cursor.y + 1,
            };
        }
        let monitor = MonitorFromRect(&anchor, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO {
            cbSize: size_of::<MONITORINFO>() as u32,
            ..zeroed()
        };
        GetMonitorInfoW(monitor, &mut info);
        let (mut dpi_x, mut dpi_y) = (96u32, 96u32);
        if GetDpiForMonitor(monitor, MDT_EFFECTIVE_DPI, &mut dpi_x, &mut dpi_y) < 0 {
            dpi_x = 96;
        }
        (anchor, info, dpi_x)
    }
}

/// Nearest position inside the work area: above a bottom taskbar, below a
/// top one, beside a vertical one. Never calls `refresh`.
fn place_panel(hwnd: HWND, anchor: RECT, info: &MONITORINFO, dpi: u32, show: bool) {
    let Some((width, height)) = with_app(|app| app.size) else {
        return;
    };
    let work = info.rcWork;
    let margin = scale(12, dpi);
    let height = height.min(work.bottom - work.top - 2 * margin);
    let center_x = (anchor.left + anchor.right) / 2;
    let center_y = (anchor.top + anchor.bottom) / 2;
    let x = clamp(
        center_x - width / 2,
        work.left + margin,
        work.right - width - margin,
    );
    let y = clamp(
        center_y - height / 2,
        work.top + margin,
        work.bottom - height - margin,
    );
    let flags = if show { SWP_SHOWWINDOW } else { SWP_NOACTIVATE };
    unsafe { SetWindowPos(hwnd, HWND_TOPMOST, x, y, width, height, flags) };
}

fn clamp(value: i32, low: i32, high: i32) -> i32 {
    if high < low {
        low
    } else {
        value.clamp(low, high)
    }
}

fn button(hwnd: HWND, id: i32) -> Option<HWND> {
    let handle = unsafe { GetDlgItem(hwnd, id) };
    (!handle.is_null()).then_some(handle)
}

fn scale(value: i32, dpi: u32) -> i32 {
    (value as i64 * dpi as i64 / 96) as i32
}

fn set_dpi(dpi: u32) {
    with_app(|app| {
        if app.dpi != dpi || app.fonts.is_empty() {
            for font in app.fonts.drain().map(|(_, font)| font) {
                unsafe { DeleteObject(font) };
            }
            app.dpi = dpi;
            app.fonts = create_fonts(dpi);
        }
    });
}

fn create_fonts(dpi: u32) -> HashMap<Font, HFONT> {
    let make = |size: i32, weight: i32, face: *const u16| unsafe {
        CreateFontW(
            -scale(size, dpi),
            0,
            0,
            0,
            weight,
            0,
            0,
            0,
            DEFAULT_CHARSET as u32,
            OUT_DEFAULT_PRECIS as u32,
            CLIP_DEFAULT_PRECIS as u32,
            CLEARTYPE_QUALITY as u32,
            0,
            face,
        )
    };
    let ui = w!("Segoe UI");
    let icons = w!("Segoe MDL2 Assets");
    HashMap::from([
        (Font::Brand, make(12, 700, ui)),
        (Font::Title, make(23, 700, ui)),
        (Font::Body, make(13, 400, ui)),
        (Font::Small, make(11, 400, ui)),
        (Font::Tiny, make(9, 600, ui)),
        (Font::Strong, make(13, 600, ui)),
        (Font::Mono, make(15, 500, w!("Consolas"))),
        (Font::Button, make(12, 400, ui)),
        (Font::ButtonStrong, make(12, 600, ui)),
        (Font::Icon, make(16, 400, icons)),
        (Font::IconSmall, make(12, 400, icons)),
        (Font::IconHero, make(72, 400, icons)),
    ])
}

/// Recomputes texts, layout and button state, then repaints. Applies
/// Win32 changes only after releasing the `APP` borrow.
fn refresh(hwnd: HWND) {
    if with_app(|app| app.fonts.is_empty()).unwrap_or(false) {
        set_dpi(96);
    }
    let Some(updates) = with_app(|app| {
        layout(app);
        app.buttons
            .iter()
            .map(|(id, spec)| (*id, spec.rect, spec.enabled, spec.label.clone()))
            .collect::<Vec<_>>()
    }) else {
        return;
    };
    let size = with_app(|app| app.size).unwrap_or((WIDTH, 600));
    unsafe {
        for (id, rect, enabled, label) in updates {
            if let Some(child) = button(hwnd, id) {
                // Window text is the accessible name read by Narrator.
                let text: Vec<u16> = label.encode_utf16().chain([0]).collect();
                SetWindowTextW(child, text.as_ptr());
                EnableWindow(child, enabled as i32);
                SetWindowPos(
                    child,
                    null_mut(),
                    rect.left,
                    rect.top,
                    rect.right - rect.left,
                    rect.bottom - rect.top,
                    SWP_NOZORDER | SWP_NOACTIVATE,
                );
                InvalidateRect(child, null(), 0);
            }
        }
        let mut current: RECT = zeroed();
        GetWindowRect(hwnd, &mut current);
        let resized =
            current.right - current.left != size.0 || current.bottom - current.top != size.1;
        if resized && IsWindowVisible(hwnd) != 0 {
            // Content grew or shrank (e.g. a long error): stay attached to the icon.
            let (anchor, info, dpi) = anchor_monitor(hwnd);
            place_panel(hwnd, anchor, &info, dpi, false);
        } else if resized {
            SetWindowPos(
                hwnd,
                null_mut(),
                0,
                0,
                size.0,
                size.1,
                SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOMOVE,
            );
        }
        InvalidateRect(hwnd, null(), 0);
    }
}

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().collect()
}

/// Lays out the panel top to bottom (same order as the macOS ServerPanel).
fn layout(app: &mut App) {
    let s: &Strings = app.lang.strings();
    let state = &app.state;
    let dpi = app.dpi;
    let px = |v: i32| scale(v, dpi);
    let width = px(WIDTH);
    let pad = px(PAD);
    let inner = width - 2 * pad;
    let center = DT_CENTER | DT_WORDBREAK | DT_NOPREFIX;
    let left = DT_LEFT | DT_WORDBREAK | DT_NOPREFIX;
    let single = DT_LEFT | DT_SINGLELINE | DT_VCENTER | DT_NOPREFIX | DT_END_ELLIPSIS;

    let hdc = unsafe { GetDC(app.hwnd) };
    let fonts = &app.fonts;
    let measure = |text: &[u16], font: Font, width: i32, format: DRAW_TEXT_FORMAT| -> i32 {
        let mut rect = RECT {
            left: 0,
            top: 0,
            right: width,
            bottom: 0,
        };
        unsafe {
            let old = SelectObject(hdc, fonts[&font]);
            DrawTextW(
                hdc,
                text.as_ptr(),
                text.len() as i32,
                &mut rect,
                format | DT_CALCRECT,
            );
            SelectObject(hdc, old);
        }
        rect.bottom - rect.top
    };

    let mut ops = Vec::new();
    let mut buttons = HashMap::new();
    let text = |ops: &mut Vec<Op>, rect: RECT, value: &str, font, color, format| {
        ops.push(Op::Text {
            rect,
            text: wide(value),
            font,
            color,
            format,
        });
    };
    let rect = |l: i32, t: i32, w: i32, h: i32| RECT {
        left: l,
        top: t,
        right: l + w,
        bottom: t + h,
    };
    let online = state.online();

    // Header: logo, brand, language chip.
    let mut y = pad;
    let logo = rect(pad, y, px(36), px(36));
    ops.push(Op::Logo(logo));
    text(
        &mut ops,
        rect(pad + px(48), y, px(160), px(36)),
        "REMOTE MOUSE",
        Font::Brand,
        TEXT,
        single,
    );
    buttons.insert(
        ID_LANGUAGE,
        ButtonSpec {
            style: Style::Chip,
            glyph: Some(GLYPH_GLOBE),
            label: app.lang.short().to_owned(),
            enabled: true,
            backdrop: None,
            rect: rect(width - pad - px(66), y + px(4), px(66), px(28)),
        },
    );
    y += px(36) + px(16);

    // Illustration card with the status badge.
    let hero = rect(pad, y, inner, px(124));
    ops.push(Op::Card(hero));
    text(
        &mut ops,
        hero,
        &String::from_utf16_lossy(&[GLYPH_LAPTOP]),
        Font::IconHero,
        rgb(140, 199, 255),
        DT_CENTER | DT_SINGLELINE | DT_VCENTER,
    );
    if online {
        let size = px(30);
        let badge = rect(
            hero.left + inner / 2 + px(40),
            hero.top + px(20),
            size,
            size,
        );
        ops.push(Op::Dot(badge, GREEN));
        let glyph = if state.client_connected {
            GLYPH_CHECK
        } else {
            GLYPH_WIFI
        };
        text(
            &mut ops,
            badge,
            &String::from_utf16_lossy(&[glyph]),
            Font::IconSmall,
            TEXT,
            DT_CENTER | DT_SINGLELINE | DT_VCENTER,
        );
    }
    y = hero.bottom + px(16);

    // Title and detail.
    let title = wide(state.title(s));
    let height = measure(&title, Font::Title, inner, center);
    ops.push(Op::Text {
        rect: rect(pad, y, inner, height),
        text: title,
        font: Font::Title,
        color: TEXT,
        format: center,
    });
    y += height + px(4);
    let detail = wide(&state.detail(s));
    let height = measure(&detail, Font::Body, inner, center);
    ops.push(Op::Text {
        rect: rect(pad, y, inner, height),
        text: detail,
        font: Font::Body,
        color: MUTED,
        format: center,
    });
    y += height + px(16);

    // Network card: name + online dot, endpoints, discovery and phone status.
    let card_pad = px(15);
    let card_inner = inner - 2 * card_pad;
    let card_top = y;
    y += card_pad;
    let name = state
        .computer_name
        .clone()
        .unwrap_or_else(|| computer_name().unwrap_or_else(|| s.name_pc.to_owned()));
    let status = if online {
        s.network_online
    } else {
        s.network_offline
    };
    let status_width = px(84);
    text(
        &mut ops,
        rect(pad + card_pad, y, px(20), px(20)),
        &String::from_utf16_lossy(&[GLYPH_LAPTOP]),
        Font::IconSmall,
        TEXT,
        single,
    );
    text(
        &mut ops,
        rect(
            pad + card_pad + px(22),
            y,
            card_inner - px(22) - status_width,
            px(20),
        ),
        &name,
        Font::Strong,
        TEXT,
        single,
    );
    let dot = px(6);
    let status_text = wide(status);
    let status_text_width = measure_width(hdc, fonts[&Font::Small], &status_text);
    let status_right = pad + card_pad + card_inner;
    ops.push(Op::Dot(
        rect(
            status_right - status_text_width - px(6) - dot,
            y + px(7),
            dot,
            dot,
        ),
        if online { GREEN } else { MUTED },
    ));
    text(
        &mut ops,
        rect(status_right - status_width, y, status_width, px(20)),
        status,
        Font::Small,
        TEXT,
        DT_RIGHT | DT_SINGLELINE | DT_VCENTER | DT_NOPREFIX,
    );
    y += px(20) + px(9);
    let endpoints = state.endpoints();
    if endpoints.is_empty() {
        let value = if online {
            s.network_noip.to_owned()
        } else {
            crate::l10n::fill(s.network_wait, state.port)
        };
        let value = wide(&value);
        let height = measure(&value, Font::Body, card_inner, left);
        ops.push(Op::Text {
            rect: rect(pad + card_pad, y, card_inner, height),
            text: value,
            font: Font::Body,
            color: MUTED,
            format: left,
        });
        y += height + px(6);
    } else {
        for endpoint in endpoints {
            text(
                &mut ops,
                rect(pad + card_pad, y, card_inner, px(22)),
                &endpoint,
                Font::Mono,
                TEXT,
                single,
            );
            y += px(22) + px(4);
        }
    }
    if online {
        for line in [
            if state.mdns {
                s.network_discovery
            } else {
                s.network_manual
            },
            if state.client_connected {
                s.network_connected
            } else {
                s.network_waiting
            },
        ] {
            let value = wide(line);
            let height = measure(&value, Font::Small, card_inner, left);
            ops.push(Op::Text {
                rect: rect(pad + card_pad, y, card_inner, height),
                text: value,
                font: Font::Small,
                color: MUTED,
                format: left,
            });
            y += height + px(4);
        }
    }
    y += card_pad - px(4);
    ops.insert(0, Op::Card(rect(pad, card_top, inner, y - card_top)));
    y += px(12);

    // Firewall card (the Windows counterpart of the macOS permission card).
    let card_top = y;
    y += card_pad;
    let fw_color = if state.port_blocked() { CYAN } else { TEXT };
    text(
        &mut ops,
        rect(pad + card_pad, y, px(20), px(18)),
        &String::from_utf16_lossy(&[GLYPH_SHIELD]),
        Font::IconSmall,
        fw_color,
        single,
    );
    text(
        &mut ops,
        rect(pad + card_pad + px(22), y, card_inner - px(22), px(18)),
        s.firewall_title,
        Font::Strong,
        fw_color,
        single,
    );
    y += px(18) + px(8);
    let value = wide(state.firewall_text(s));
    let height = measure(&value, Font::Small, card_inner, left);
    ops.push(Op::Text {
        rect: rect(pad + card_pad, y, card_inner, height),
        text: value,
        font: Font::Small,
        color: MUTED,
        format: left,
    });
    y += height + px(6);
    buttons.insert(
        ID_FIREWALL,
        ButtonSpec {
            style: Style::Link,
            glyph: None,
            label: s.button_firewall.to_owned(),
            enabled: true,
            backdrop: None,
            rect: rect(pad + card_pad - px(2), y, card_inner, px(22)),
        },
    );
    y += px(22) + card_pad - px(4);
    let card = rect(pad, card_top, inner, y - card_top);
    ops.insert(0, Op::Card(card));
    if let Some(link) = buttons.get_mut(&ID_FIREWALL) {
        let height = (card.bottom - card.top).max(1) as f32;
        let at = |y: i32| mix(CARD_TOP, CARD_BOTTOM, (y - card.top) as f32 / height);
        link.backdrop = Some((at(link.rect.top), at(link.rect.bottom)));
    }
    y += px(16);

    // Copy + network settings.
    let row = px(42);
    let copy_label = if state.copied {
        s.button_copied
    } else {
        s.button_copy
    };
    buttons.insert(
        ID_COPY,
        ButtonSpec {
            style: Style::Secondary,
            glyph: Some(if state.copied {
                GLYPH_CHECK
            } else {
                GLYPH_COPY
            }),
            label: copy_label.to_owned(),
            enabled: state.address().is_some(),
            backdrop: None,
            rect: rect(pad, y, inner - row - px(10), row),
        },
    );
    buttons.insert(
        ID_NETWORK,
        ButtonSpec {
            style: Style::Secondary,
            glyph: Some(GLYPH_WIFI),
            label: s.button_network.to_owned(),
            enabled: true,
            backdrop: None,
            rect: rect(pad + inner - row, y, row, row),
        },
    );
    y += row + px(10);

    let running = app.agent.is_some() && !matches!(state.phase, crate::model::Phase::Stopping);
    buttons.insert(
        ID_TOGGLE,
        ButtonSpec {
            style: Style::Primary,
            glyph: Some(if running { GLYPH_STOP } else { GLYPH_POWER }),
            label: (if running {
                s.button_stop
            } else {
                s.button_start
            })
            .to_owned(),
            enabled: !state.busy() && !app.quitting,
            backdrop: None,
            rect: rect(pad, y, inner, px(46)),
        },
    );
    y += px(46) + px(14);

    let help = wide(s.connection_help);
    let height = measure(&help, Font::Small, inner, center);
    ops.push(Op::Text {
        rect: rect(pad, y, inner, height),
        text: help,
        font: Font::Small,
        color: MUTED,
        format: center,
    });
    y += height + px(14);

    // Footer.
    text(
        &mut ops,
        rect(pad, y, px(200), px(24)),
        "REMOTE MOUSE · WINDOWS",
        Font::Tiny,
        MUTED,
        single,
    );
    buttons.insert(
        ID_QUIT,
        ButtonSpec {
            style: Style::Link,
            glyph: None,
            label: s.button_quit.to_owned(),
            enabled: true,
            backdrop: None,
            rect: rect(width - pad - px(90), y, px(90), px(24)),
        },
    );
    y += px(24) + pad;

    unsafe { ReleaseDC(app.hwnd, hdc) };
    app.ops = ops;
    app.buttons = buttons;
    app.size = (width, y);
}

fn measure_width(hdc: HDC, font: HFONT, text: &[u16]) -> i32 {
    let mut size: SIZE = unsafe { zeroed() };
    unsafe {
        let old = SelectObject(hdc, font);
        GetTextExtentPoint32W(hdc, text.as_ptr(), text.len() as i32, &mut size);
        SelectObject(hdc, old);
    }
    size.cx
}

fn computer_name() -> Option<String> {
    let mut buffer = [0u16; 256];
    let mut length = buffer.len() as u32;
    let ok = unsafe {
        windows_sys::Win32::System::SystemInformation::GetComputerNameExW(
            windows_sys::Win32::System::SystemInformation::ComputerNamePhysicalDnsHostname,
            buffer.as_mut_ptr(),
            &mut length,
        )
    };
    (ok != 0 && length > 0).then(|| String::from_utf16_lossy(&buffer[..length as usize]))
}

// ---------------------------------------------------------------- painting

fn vertex(x: i32, y: i32, color: COLORREF) -> TRIVERTEX {
    let channel = |shift: u32| (((color >> shift) & 0xff) as u16) << 8;
    TRIVERTEX {
        x,
        y,
        Red: channel(0),
        Green: channel(8),
        Blue: channel(16),
        Alpha: 0,
    }
}

fn gradient(hdc: HDC, rect: RECT, from: COLORREF, to: COLORREF, horizontal: bool) {
    let vertices = [
        vertex(rect.left, rect.top, from),
        vertex(rect.right, rect.bottom, to),
    ];
    let mesh = GRADIENT_RECT {
        UpperLeft: 0,
        LowerRight: 1,
    };
    let mode = if horizontal {
        GRADIENT_FILL_RECT_H
    } else {
        GRADIENT_FILL_RECT_V
    };
    unsafe { GradientFill(hdc, vertices.as_ptr(), 2, (&raw const mesh).cast(), 1, mode) };
}

fn mix(from: COLORREF, to: COLORREF, t: f32) -> COLORREF {
    let channel = |shift: u32| {
        let a = ((from >> shift) & 0xff) as f32;
        let b = ((to >> shift) & 0xff) as f32;
        ((a + (b - a) * t.clamp(0.0, 1.0)).round() as u32) << shift
    };
    channel(0) | channel(8) | channel(16)
}

/// Fills a rounded rectangle with a gradient and draws its 1 px border.
fn rounded(
    hdc: HDC,
    rect: RECT,
    radius: i32,
    from: COLORREF,
    to: COLORREF,
    horizontal: bool,
    border: Option<COLORREF>,
) {
    unsafe {
        let region = CreateRoundRectRgn(
            rect.left,
            rect.top,
            rect.right + 1,
            rect.bottom + 1,
            radius,
            radius,
        );
        SelectClipRgn(hdc, region);
        gradient(hdc, rect, from, to, horizontal);
        SelectClipRgn(hdc, null_mut());
        DeleteObject(region);
        if let Some(color) = border {
            let pen = CreatePen(PS_SOLID, 1, color);
            let old_pen = SelectObject(hdc, pen);
            let old_brush = SelectObject(hdc, GetStockObject(NULL_BRUSH));
            RoundRect(
                hdc,
                rect.left,
                rect.top,
                rect.right,
                rect.bottom,
                radius,
                radius,
            );
            SelectObject(hdc, old_brush);
            SelectObject(hdc, old_pen);
            DeleteObject(pen);
        }
    }
}

fn draw_text(
    hdc: HDC,
    font: HFONT,
    text: &[u16],
    mut rect: RECT,
    color: COLORREF,
    format: DRAW_TEXT_FORMAT,
) {
    unsafe {
        let old = SelectObject(hdc, font);
        SetTextColor(hdc, color);
        DrawTextW(hdc, text.as_ptr(), text.len() as i32, &mut rect, format);
        SelectObject(hdc, old);
    }
}

/// Double-buffered paint of the whole panel from the precomputed ops.
fn paint(hwnd: HWND) {
    unsafe {
        let mut ps: PAINTSTRUCT = zeroed();
        let hdc = BeginPaint(hwnd, &mut ps);
        let mut client: RECT = zeroed();
        GetClientRect(hwnd, &mut client);
        let buffer = CreateCompatibleDC(hdc);
        let bitmap = CreateCompatibleBitmap(hdc, client.right, client.bottom);
        let old_bitmap = SelectObject(buffer, bitmap);
        SetBkMode(buffer, TRANSPARENT as i32);
        gradient(buffer, client, BG_TOP, BG_BOTTOM, false);
        APP.with(|cell| {
            let Ok(slot) = cell.try_borrow() else { return };
            let Some(app) = slot.as_ref() else { return };
            let radius = scale(18, app.dpi);
            for op in &app.ops {
                match op {
                    Op::Card(rect) => rounded(
                        buffer,
                        *rect,
                        radius,
                        CARD_TOP,
                        CARD_BOTTOM,
                        false,
                        Some(BORDER),
                    ),
                    Op::Logo(rect) => {
                        rounded(buffer, *rect, scale(11, app.dpi), CYAN, BLUE, true, None);
                        let glyph = [GLYPH_MOUSE];
                        draw_text(
                            buffer,
                            app.fonts[&Font::Icon],
                            &glyph,
                            *rect,
                            TEXT,
                            DT_CENTER | DT_SINGLELINE | DT_VCENTER,
                        );
                    }
                    Op::Dot(rect, color) => {
                        let brush = CreateSolidBrush(*color);
                        let pen = CreatePen(PS_SOLID, 1, *color);
                        let old_brush = SelectObject(buffer, brush);
                        let old_pen = SelectObject(buffer, pen);
                        Ellipse(buffer, rect.left, rect.top, rect.right, rect.bottom);
                        SelectObject(buffer, old_brush);
                        SelectObject(buffer, old_pen);
                        DeleteObject(brush);
                        DeleteObject(pen);
                    }
                    Op::Text {
                        rect,
                        text,
                        font,
                        color,
                        format,
                    } => {
                        draw_text(buffer, app.fonts[font], text, *rect, *color, *format);
                    }
                }
            }
        });
        BitBlt(
            hdc,
            0,
            0,
            client.right,
            client.bottom,
            buffer,
            0,
            0,
            SRCCOPY,
        );
        SelectObject(buffer, old_bitmap);
        DeleteObject(bitmap);
        DeleteDC(buffer);
        EndPaint(hwnd, &ps);
    }
}

/// Owner-drawn buttons in the macOS PanelButtonStyle look.
fn draw_button(item: &DRAWITEMSTRUCT) {
    APP.with(|cell| {
        let Ok(slot) = cell.try_borrow() else { return };
        let Some(app) = slot.as_ref() else { return };
        let Some(spec) = app.buttons.get(&(item.CtlID as i32)) else {
            return;
        };
        let rect = item.rcItem;
        let (width, height) = (rect.right - rect.left, rect.bottom - rect.top);
        let pressed = item.itemState & ODS_SELECTED != 0;
        let disabled = item.itemState & ODS_DISABLED != 0 || !spec.enabled;
        let focused = item.itemState & ODS_FOCUS != 0;
        unsafe {
            let buffer = CreateCompatibleDC(item.hDC);
            let bitmap = CreateCompatibleBitmap(item.hDC, width, height);
            let old_bitmap = SelectObject(buffer, bitmap);
            SetBkMode(buffer, TRANSPARENT as i32);
            // Repaint the panel background slice behind the rounded corners.
            let panel_height = app.size.1.max(1) as f32;
            let (top, bottom) = spec.backdrop.unwrap_or((
                mix(BG_TOP, BG_BOTTOM, spec.rect.top as f32 / panel_height),
                mix(BG_TOP, BG_BOTTOM, spec.rect.bottom as f32 / panel_height),
            ));
            let local = RECT {
                left: 0,
                top: 0,
                right: width,
                bottom: height,
            };
            gradient(buffer, local, top, bottom, false);
            let radius = scale(if spec.style == Style::Chip { 14 } else { 16 }, app.dpi);
            let dim = |color: COLORREF| {
                if pressed {
                    mix(color, BG_BOTTOM, 0.3)
                } else {
                    color
                }
            };
            let border = if focused { Some(CYAN) } else { Some(BORDER) };
            match spec.style {
                Style::Primary => rounded(
                    buffer,
                    local,
                    radius,
                    dim(PRIMARY_LEFT),
                    dim(PRIMARY_RIGHT),
                    true,
                    border,
                ),
                Style::Secondary | Style::Chip => rounded(
                    buffer,
                    local,
                    radius,
                    dim(CARD_TOP),
                    dim(CARD_BOTTOM),
                    false,
                    border,
                ),
                Style::Link => {
                    if focused {
                        rounded(buffer, local, radius, top, bottom, false, Some(CYAN));
                    }
                }
            }
            let color = if disabled {
                mix(MUTED, BG_BOTTOM, 0.35)
            } else if spec.style == Style::Link {
                if item.CtlID as i32 == ID_QUIT {
                    MUTED
                } else {
                    CYAN
                }
            } else {
                TEXT
            };
            let label_font = if spec.style == Style::Primary {
                Font::ButtonStrong
            } else {
                Font::Button
            };
            let icon_font = if spec.style == Style::Chip {
                Font::IconSmall
            } else {
                Font::Icon
            };
            // The square network button shows only its glyph; its label stays
            // the accessible name and tooltip-like window text.
            let show_label = item.CtlID as i32 != ID_NETWORK;
            let label = if show_label {
                wide(&spec.label)
            } else {
                Vec::new()
            };
            let glyph = spec.glyph.map(|g| vec![g]).unwrap_or_default();
            let gap = if glyph.is_empty() || label.is_empty() {
                0
            } else {
                scale(8, app.dpi)
            };
            let glyph_width = if glyph.is_empty() {
                0
            } else {
                measure_width(buffer, app.fonts[&icon_font], &glyph)
            };
            let label_width = measure_width(buffer, app.fonts[&label_font], &label);
            let total = glyph_width + gap + label_width;
            let (mut x, align) = if spec.style == Style::Link && item.CtlID as i32 == ID_FIREWALL {
                (scale(2, app.dpi), DT_LEFT)
            } else if spec.style == Style::Link {
                (width - total - scale(2, app.dpi), DT_LEFT)
            } else {
                ((width - total) / 2, DT_LEFT)
            };
            let format = align | DT_SINGLELINE | DT_VCENTER | DT_NOPREFIX;
            if !glyph.is_empty() {
                draw_text(
                    buffer,
                    app.fonts[&icon_font],
                    &glyph,
                    RECT {
                        left: x,
                        top: 0,
                        right: x + glyph_width,
                        bottom: height,
                    },
                    color,
                    format,
                );
                x += glyph_width + gap;
            }
            if !label.is_empty() {
                draw_text(
                    buffer,
                    app.fonts[&label_font],
                    &label,
                    RECT {
                        left: x,
                        top: 0,
                        right: width,
                        bottom: height,
                    },
                    color,
                    format | DT_END_ELLIPSIS,
                );
            }
            BitBlt(
                item.hDC, rect.left, rect.top, width, height, buffer, 0, 0, SRCCOPY,
            );
            SelectObject(buffer, old_bitmap);
            DeleteObject(bitmap);
            DeleteDC(buffer);
        }
    });
}
