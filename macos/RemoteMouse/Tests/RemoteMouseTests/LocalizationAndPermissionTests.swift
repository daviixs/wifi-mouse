import XCTest
@testable import RemoteMouse

final class LocalizationAndPermissionTests: XCTestCase {
    func testSystemLanguageVariantsAndFallback() {
        XCTAssertEqual(L10n.preferredLanguage(["pt_BR"]), "pt-BR")
        XCTAssertEqual(L10n.preferredLanguage(["pt-PT"]), "pt-BR")
        XCTAssertEqual(L10n.preferredLanguage(["es-MX"]), "es")
        XCTAssertEqual(L10n.preferredLanguage(["en-GB"]), "en")
        XCTAssertEqual(L10n.preferredLanguage(["fr-FR", "es-ES"]), "es")
        XCTAssertEqual(L10n.preferredLanguage(["ja-JP"]), "en")
        XCTAssertEqual(L10n.preferredLanguage([]), "en")
    }

    func testActualResourceBundleContainsAllLanguages() {
        XCTAssertEqual(L10n.value("button.quit", language: "pt-BR"), "Sair")
        XCTAssertEqual(L10n.value("button.quit", language: "en"), "Quit")
        XCTAssertEqual(L10n.value("button.quit", language: "es"), "Salir")
        for language in ["pt-BR", "en", "es"] {
            for key in ["permission.required", "permission.explanation", "button.accessibility", "button.helper", "error.probe.timeout"] {
                XCTAssertNotEqual(L10n.value(key, language: language), key)
            }
            XCTAssertTrue(L10n.value("error.launch", language: language).contains("%@"))
            XCTAssertTrue(L10n.value("error.exited", language: language).contains("%d"))
        }
    }

    func testPermissionGateOnlyUnlocksAfterActualConfirmation() {
        var state = AccessibilityState()
        XCTAssertTrue(state.isBlocking) // unknown, even if parent app is authorized
        state.confirm(false)
        XCTAssertTrue(state.isBlocking)
        state.confirm(true)
        XCTAssertFalse(state.isBlocking)
        state.confirm(false) // revocation relocks
        XCTAssertTrue(state.isBlocking)
        state.confirm(nil, problem: "timeout")
        XCTAssertTrue(state.isBlocking)
        XCTAssertEqual(state.problem, "timeout")
        state.confirm(true)
        XCTAssertFalse(state.isBlocking)
        XCTAssertNil(state.problem)
    }
}
