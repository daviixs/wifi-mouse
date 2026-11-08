import Foundation
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
            for key in ["permission.required", "permission.explanation", "button.accessibility", "button.helper", "error.probe.timeout", "permission.mismatch", "button.recheck", "button.permission.diagnostic"] {
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
    func testContainerTrustIsDiagnosticOnlyAndCannotAuthorizeTheInputAgent() {
        var state = AccessibilityState()
        state.confirm(false, appTrusted: true)
        XCTAssertTrue(state.attributionMismatch)
        XCTAssertTrue(state.isBlocking)
        state.confirm(nil, problem: "probe failed", appTrusted: true)
        XCTAssertTrue(state.isBlocking)
        state.confirm(true, appTrusted: false) // helper itself confirmed; app cache is irrelevant
        XCTAssertFalse(state.isBlocking)
        XCTAssertFalse(state.attributionMismatch)
        state.confirm(false, appTrusted: true) // revoke relocks even with container allowed
        XCTAssertTrue(state.isBlocking)
        state.confirm(true, appTrusted: true) // fresh process after relaunch/grant
        XCTAssertFalse(state.isBlocking)
    }

    func testFoundationResolvesFlatAndSwiftBuildResourceRoots() throws {
        let manager = FileManager.default
        let temporary = manager.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try manager.createDirectory(at: temporary, withIntermediateDirectories: true)
        defer { try? manager.removeItem(at: temporary) }
        for deep in [false, true] {
            for spelling in ["pt-br", "pt-BR", "pt_BR"] {
                let bundleURL = temporary.appendingPathComponent(UUID().uuidString + ".bundle")
                let root = deep ? bundleURL.appendingPathComponent("Contents/Resources") : bundleURL
                let locale = root.appendingPathComponent(spelling + ".lproj")
                try manager.createDirectory(at: locale, withIntermediateDirectories: true)
                let infoURL = deep ? bundleURL.appendingPathComponent("Contents/Info.plist")
                    : bundleURL.appendingPathComponent("Info.plist")
                let info: [String: String] = ["CFBundleDevelopmentRegion": "en", "CFBundlePackageType": "BNDL"]
                try PropertyListSerialization.data(fromPropertyList: info, format: .xml, options: 0).write(to: infoURL)
                let table = ["fixture.quit": "Sair"]
                try PropertyListSerialization.data(fromPropertyList: table, format: .binary, options: 0)
                    .write(to: locale.appendingPathComponent("Localizable.strings"))
                let resources = try XCTUnwrap(Bundle(url: bundleURL))
                let localized = try XCTUnwrap(L10n.localizedBundle("pt-BR", in: resources))
                XCTAssertNil(L10n.localizedBundle("es", in: resources)) // do not fall back to another language
                XCTAssertEqual(localized.localizedString(forKey: "fixture.quit", value: nil, table: "Localizable"), "Sair")
            }
        }
    }

}
