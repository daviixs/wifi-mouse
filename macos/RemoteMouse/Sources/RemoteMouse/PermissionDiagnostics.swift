import Foundation
import Security

/// Read-only inspection of our code, not the user's permission database.
enum PermissionDiagnostics {
    static func signature(_ url: URL) -> [String: Any] {
        var code: SecStaticCode?
        let created = SecStaticCodeCreateWithPath(url as CFURL, SecCSFlags(rawValue: 0), &code)
        guard created == errSecSuccess, let code else { return ["status": created] }
        let validity = SecStaticCodeCheckValidity(code, SecCSFlags(rawValue: 0), nil)
        var information: CFDictionary?
        let status = SecCodeCopySigningInformation(code, SecCSFlags(rawValue: kSecCSSigningInformation), &information)
        guard status == errSecSuccess, let values = information as? [String: Any] else {
            return ["status": status, "validity": validity]
        }
        let hash = (values[kSecCodeInfoUnique as String] as? Data)?.map { String(format: "%02x", $0) }.joined() ?? "none"
        return ["status": status, "validity": validity,
                "identifier": values[kSecCodeInfoIdentifier as String] as? String ?? "none",
                "team": values[kSecCodeInfoTeamIdentifier as String] as? String ?? "none",
                "flags": (values[kSecCodeInfoFlags as String] as? NSNumber)?.uint32Value ?? 0,
                "cdhash": hash]
    }
}
