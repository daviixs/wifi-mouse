//! UI strings in pt-BR, en and es. Every language is a full [`Strings`] value,
//! so a missing translation is a compile error rather than a runtime fallback.
//! Wording follows the macOS app (`macos/RemoteMouse/.../Localizable.strings`),
//! with "Mac" replaced by "PC" and Accessibility replaced by Windows Firewall.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Lang {
    PtBr,
    En,
    Es,
}

impl Lang {
    pub const ALL: [Lang; 3] = [Lang::PtBr, Lang::En, Lang::Es];

    /// Stable tag stored in the registry.
    pub fn tag(self) -> &'static str {
        match self {
            Lang::PtBr => "pt-BR",
            Lang::En => "en",
            Lang::Es => "es",
        }
    }

    /// Short label for the language button.
    pub fn short(self) -> &'static str {
        match self {
            Lang::PtBr => "PT",
            Lang::En => "EN",
            Lang::Es => "ES",
        }
    }

    /// Native name, shown untranslated in the language menu.
    pub fn native_name(self) -> &'static str {
        match self {
            Lang::PtBr => "Português (Brasil)",
            Lang::En => "English",
            Lang::Es => "Español",
        }
    }

    pub fn next(self) -> Lang {
        match self {
            Lang::PtBr => Lang::En,
            Lang::En => Lang::Es,
            Lang::Es => Lang::PtBr,
        }
    }

    /// Parses a stored tag or a BCP-47 locale name such as `pt-PT` or `es_MX`.
    pub fn from_locale_name(name: &str) -> Option<Lang> {
        let primary = name
            .trim()
            .split(['-', '_'])
            .next()
            .unwrap_or_default()
            .to_ascii_lowercase();
        match primary.as_str() {
            "pt" => Some(Lang::PtBr),
            "en" => Some(Lang::En),
            "es" => Some(Lang::Es),
            _ => None,
        }
    }

    /// Maps a Win32 LANGID (`GetUserDefaultUILanguage`) by its primary language.
    pub fn from_langid(langid: u16) -> Option<Lang> {
        match langid & 0x3ff {
            0x16 => Some(Lang::PtBr), // LANG_PORTUGUESE
            0x09 => Some(Lang::En),   // LANG_ENGLISH
            0x0a => Some(Lang::Es),   // LANG_SPANISH
            _ => None,
        }
    }

    /// Saved choice first, then UI language, then regional locale, then English
    /// (the same fallback as the macOS app).
    pub fn resolve(saved: Option<&str>, ui_langid: u16, locale_name: &str) -> Lang {
        saved
            .and_then(Lang::from_locale_name)
            .or_else(|| Lang::from_langid(ui_langid))
            .or_else(|| Lang::from_locale_name(locale_name))
            .unwrap_or(Lang::En)
    }

    pub fn strings(self) -> &'static Strings {
        match self {
            Lang::PtBr => &PT_BR,
            Lang::En => &EN,
            Lang::Es => &ES,
        }
    }
}

/// `{}` in a value is replaced by [`fill`].
pub struct Strings {
    pub name_pc: &'static str,
    pub detail_idle: &'static str,
    pub detail_starting: &'static str,
    pub detail_ready: &'static str,
    pub detail_stopped: &'static str,
    pub title_idle: &'static str,
    pub title_starting: &'static str,
    pub title_stopping: &'static str,
    pub title_failed: &'static str,
    pub title_connected: &'static str,
    pub title_ready: &'static str,
    pub error_port_in_use: &'static str,
    pub error_port_denied: &'static str,
    pub error_agent: &'static str,
    pub error_exited: &'static str,
    pub button_copy: &'static str,
    pub button_copied: &'static str,
    pub button_network: &'static str,
    pub button_start: &'static str,
    pub button_stop: &'static str,
    pub button_open: &'static str,
    pub button_quit: &'static str,
    pub button_firewall: &'static str,
    pub button_language: &'static str,
    pub connection_help: &'static str,
    pub network_online: &'static str,
    pub network_offline: &'static str,
    pub network_noip: &'static str,
    pub network_wait: &'static str,
    pub network_discovery: &'static str,
    pub network_manual: &'static str,
    pub network_connected: &'static str,
    pub network_waiting: &'static str,
    pub firewall_title: &'static str,
    pub firewall_first_run: &'static str,
    pub firewall_running: &'static str,
    pub firewall_blocked: &'static str,
    pub welcome_body: &'static str,
}

pub fn fill(template: &str, value: impl std::fmt::Display) -> String {
    template.replacen("{}", &value.to_string(), 1)
}

pub static PT_BR: Strings = Strings {
    name_pc: "Meu PC",
    detail_idle: "Inicie o servidor para conectar seu celular.",
    detail_starting: "Preparando a conexão com seu celular…",
    detail_ready: "Abra o Remote Mouse no celular e escolha este PC.",
    detail_stopped: "Servidor parado. Seu PC não está recebendo comandos.",
    title_idle: "Seu PC, sem fios.",
    title_starting: "Iniciando…",
    title_stopping: "Encerrando…",
    title_failed: "Vamos tentar de novo?",
    title_connected: "Conectado!",
    title_ready: "Pronto para conectar!",
    error_port_in_use: "A porta {} já está em uso. Feche outra cópia do Remote Mouse ou o programa que usa essa porta e tente de novo.",
    error_port_denied: "O Windows recusou a porta {} (porta reservada, antivírus ou política da empresa). Verifique e tente de novo.",
    error_agent: "Falha no servidor: {}",
    error_exited: "O servidor encerrou inesperadamente. Tente iniciar de novo.",
    button_copy: "Copiar endereço",
    button_copied: "Copiado!",
    button_network: "Abrir configurações de rede",
    button_start: "Iniciar servidor",
    button_stop: "Parar servidor",
    button_open: "Abrir",
    button_quit: "Sair",
    button_firewall: "Abrir Firewall do Windows",
    button_language: "Idioma",
    connection_help: "No celular, use a mesma rede Wi-Fi. O PC aparece automaticamente; se não aparecer, digite o IP acima. Use apenas redes confiáveis.",
    network_online: "Online",
    network_offline: "Offline",
    network_noip: "Sem IP local. Verifique o Wi-Fi ou o cabo de rede.",
    network_wait: "Porta {} · aguardando início",
    network_discovery: "Descoberta automática disponível",
    network_manual: "Descoberta indisponível · conecte pelo IP",
    network_connected: "Celular conectado por WebSocket",
    network_waiting: "Aguardando o celular",
    firewall_title: "Firewall do Windows",
    firewall_first_run: "Na primeira vez que o servidor iniciar, o Windows pode pedir acesso à rede. Marque Redes privadas e clique em Permitir.",
    firewall_running: "Se o celular não encontrar o PC, permita o Remote Mouse em redes privadas no Firewall e confira se o Wi-Fi está como rede privada.",
    firewall_blocked: "A porta não pôde ser aberta. Libere o Remote Mouse no Firewall ou feche o programa que usa a porta.",
    welcome_body: "O Remote Mouse está na área de notificação. Clique no ícone do mouse para abrir.",
};

pub static EN: Strings = Strings {
    name_pc: "My PC",
    detail_idle: "Start the server to connect your phone.",
    detail_starting: "Preparing the connection to your phone…",
    detail_ready: "Open Remote Mouse on your phone and select this PC.",
    detail_stopped: "Server stopped. Your PC is not receiving commands.",
    title_idle: "Your PC, wireless.",
    title_starting: "Starting…",
    title_stopping: "Stopping…",
    title_failed: "Try again?",
    title_connected: "Connected!",
    title_ready: "Ready to connect!",
    error_port_in_use: "Port {} is already in use. Close another copy of Remote Mouse or the program using that port and try again.",
    error_port_denied: "Windows refused port {} (reserved port, antivirus or company policy). Check it and try again.",
    error_agent: "Server error: {}",
    error_exited: "The server stopped unexpectedly. Try starting it again.",
    button_copy: "Copy address",
    button_copied: "Copied!",
    button_network: "Open network settings",
    button_start: "Start server",
    button_stop: "Stop server",
    button_open: "Open",
    button_quit: "Quit",
    button_firewall: "Open Windows Firewall",
    button_language: "Language",
    connection_help: "Use the same Wi-Fi network on your phone. Your PC appears automatically; otherwise, enter the IP above. Use trusted networks only.",
    network_online: "Online",
    network_offline: "Offline",
    network_noip: "No local IP. Check your Wi-Fi or network cable.",
    network_wait: "Port {} · waiting to start",
    network_discovery: "Automatic discovery available",
    network_manual: "Discovery unavailable · connect using the IP",
    network_connected: "Phone connected via WebSocket",
    network_waiting: "Waiting for your phone",
    firewall_title: "Windows Firewall",
    firewall_first_run: "The first time the server starts, Windows may ask for network access. Select Private networks and click Allow.",
    firewall_running: "If your phone cannot find this PC, allow Remote Mouse on private networks in the Firewall and make sure your Wi-Fi is set as a private network.",
    firewall_blocked: "The port could not be opened. Allow Remote Mouse in the Firewall or close the program using the port.",
    welcome_body: "Remote Mouse is in the notification area. Click the mouse icon to open it.",
};

pub static ES: Strings = Strings {
    name_pc: "Mi PC",
    detail_idle: "Inicia el servidor para conectar tu teléfono.",
    detail_starting: "Preparando la conexión con tu teléfono…",
    detail_ready: "Abre Remote Mouse en tu teléfono y elige este PC.",
    detail_stopped: "Servidor detenido. Tu PC no está recibiendo comandos.",
    title_idle: "Tu PC, sin cables.",
    title_starting: "Iniciando…",
    title_stopping: "Cerrando…",
    title_failed: "¿Lo intentamos de nuevo?",
    title_connected: "¡Conectado!",
    title_ready: "¡Listo para conectar!",
    error_port_in_use: "El puerto {} ya está en uso. Cierra otra copia de Remote Mouse o el programa que usa ese puerto e inténtalo de nuevo.",
    error_port_denied: "Windows rechazó el puerto {} (puerto reservado, antivirus o política de la empresa). Revísalo e inténtalo de nuevo.",
    error_agent: "Error del servidor: {}",
    error_exited: "El servidor se cerró inesperadamente. Intenta iniciarlo de nuevo.",
    button_copy: "Copiar dirección",
    button_copied: "¡Copiado!",
    button_network: "Abrir configuración de red",
    button_start: "Iniciar servidor",
    button_stop: "Detener servidor",
    button_open: "Abrir",
    button_quit: "Salir",
    button_firewall: "Abrir Firewall de Windows",
    button_language: "Idioma",
    connection_help: "Usa la misma red Wi-Fi en tu teléfono. El PC aparece automáticamente; si no aparece, introduce la IP indicada. Usa solo redes de confianza.",
    network_online: "En línea",
    network_offline: "Sin conexión",
    network_noip: "Sin IP local. Revisa el Wi-Fi o el cable de red.",
    network_wait: "Puerto {} · esperando el inicio",
    network_discovery: "Detección automática disponible",
    network_manual: "Detección no disponible · conecta por IP",
    network_connected: "Teléfono conectado por WebSocket",
    network_waiting: "Esperando tu teléfono",
    firewall_title: "Firewall de Windows",
    firewall_first_run: "La primera vez que se inicie el servidor, Windows puede pedir acceso a la red. Marca Redes privadas y haz clic en Permitir.",
    firewall_running: "Si tu teléfono no encuentra este PC, permite Remote Mouse en redes privadas en el Firewall y comprueba que el Wi-Fi sea una red privada.",
    firewall_blocked: "No se pudo abrir el puerto. Permite Remote Mouse en el Firewall o cierra el programa que usa el puerto.",
    welcome_body: "Remote Mouse está en el área de notificación. Haz clic en el icono del ratón para abrirlo.",
};

#[cfg(test)]
mod tests {
    use super::*;

    fn values(s: &Strings) -> Vec<&'static str> {
        vec![
            s.name_pc,
            s.detail_idle,
            s.detail_starting,
            s.detail_ready,
            s.detail_stopped,
            s.title_idle,
            s.title_starting,
            s.title_stopping,
            s.title_failed,
            s.title_connected,
            s.title_ready,
            s.error_port_in_use,
            s.error_port_denied,
            s.error_agent,
            s.error_exited,
            s.button_copy,
            s.button_copied,
            s.button_network,
            s.button_start,
            s.button_stop,
            s.button_open,
            s.button_quit,
            s.button_firewall,
            s.button_language,
            s.connection_help,
            s.network_online,
            s.network_offline,
            s.network_noip,
            s.network_wait,
            s.network_discovery,
            s.network_manual,
            s.network_connected,
            s.network_waiting,
            s.firewall_title,
            s.firewall_first_run,
            s.firewall_running,
            s.firewall_blocked,
            s.welcome_body,
        ]
    }

    #[test]
    fn every_language_has_non_empty_values_with_matching_placeholders() {
        let english = values(&EN);
        for lang in Lang::ALL {
            let translated = values(lang.strings());
            assert_eq!(translated.len(), english.len());
            for (value, reference) in translated.iter().zip(&english) {
                assert!(!value.trim().is_empty(), "{lang:?} has an empty value");
                assert_eq!(
                    value.matches("{}").count(),
                    reference.matches("{}").count(),
                    "{lang:?}: {value}"
                );
            }
        }
    }

    #[test]
    fn portuguese_is_chosen_for_any_portuguese_system() {
        assert_eq!(Lang::resolve(None, 0x0416, "pt-BR"), Lang::PtBr); // pt-BR UI
        assert_eq!(Lang::resolve(None, 0x0816, "pt-PT"), Lang::PtBr); // pt-PT UI
        assert_eq!(Lang::resolve(None, 0x0409, "pt-BR"), Lang::En); // English UI wins
        assert_eq!(Lang::resolve(None, 0x0411, "pt_BR"), Lang::PtBr); // ja UI, pt region
        assert_eq!(Lang::resolve(None, 0x0c0a, "es-ES"), Lang::Es);
        assert_eq!(Lang::resolve(None, 0x0411, "ja-JP"), Lang::En);
    }

    #[test]
    fn saved_choice_overrides_system_and_cycles() {
        assert_eq!(Lang::resolve(Some("es"), 0x0416, "pt-BR"), Lang::Es);
        assert_eq!(Lang::resolve(Some("garbage"), 0x0416, "pt-BR"), Lang::PtBr);
        for lang in Lang::ALL {
            assert_eq!(Lang::from_locale_name(lang.tag()), Some(lang));
        }
        assert_eq!(Lang::PtBr.next().next().next(), Lang::PtBr);
    }

    #[test]
    fn fill_replaces_one_placeholder_without_grouping_numbers() {
        assert_eq!(
            fill(EN.network_wait, 8765u16),
            "Port 8765 · waiting to start"
        );
        assert_eq!(fill(PT_BR.error_agent, "x {}"), "Falha no servidor: x {}");
    }
}
