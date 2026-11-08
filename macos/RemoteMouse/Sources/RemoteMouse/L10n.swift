import Foundation

/// Explicitly resolves the copied SwiftPM bundle inside the installed .app.
/// Never relies on the developer's .build directory at runtime.
enum L10n {
    // Bundle preferences also honor macOS's per-app language override.
    static let language = preferredLanguage(
        Bundle.main.preferredLocalizations.isEmpty
            ? Locale.preferredLanguages : Bundle.main.preferredLocalizations
    )
    static let resources: Bundle = {
        if let url = Bundle.main.resourceURL?.appendingPathComponent("RemoteMouse_RemoteMouse.bundle"),
           let bundle = Bundle(url: url) { return bundle }
        return Bundle.module // SwiftPM tests / development, not a replacement for packaging.
    }()

    static func preferredLanguage(_ preferences: [String]) -> String {
        for preference in preferences {
            let code = preference.replacingOccurrences(of: "_", with: "-").lowercased().split(separator: "-").first
            switch code {
            case "pt": return "pt-BR"
            case "es": return "es"
            case "en": return "en"
            default: continue
            }
        }
        return "en"
    }

    static func value(_ key: String, language: String) -> String {
        guard let url = resources.url(forResource: language.lowercased(), withExtension: "lproj")
                ?? resources.url(forResource: language, withExtension: "lproj"),
              let bundle = Bundle(url: url) else { return key }
        return bundle.localizedString(forKey: key, value: key, table: "Localizable")
    }

    static func text(_ key: String, _ arguments: CVarArg...) -> String {
        let format = value(key, language: language)
        return String(format: format, locale: Locale(identifier: language), arguments: arguments)
    }
}

/// Unknown/error is deliberately blocking, not interpreted as authorization.
struct AccessibilityState: Equatable {
    private(set) var trusted: Bool? = nil
    private(set) var problem: String? = nil
    var isBlocking: Bool { trusted != true }

    mutating func confirm(_ trusted: Bool?, problem: String? = nil) {
        self.trusted = trusted
        self.problem = problem
    }
}
