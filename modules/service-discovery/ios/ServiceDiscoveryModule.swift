import ExpoModulesCore
import Foundation

/// Bonjour browsing with NetServiceBrowser + NetService.resolve (gives the
/// IP addresses and TXT record directly). Requires NSBonjourServices and
/// NSLocalNetworkUsageDescription in Info.plist (set from app.json).
public class ServiceDiscoveryModule: Module {
  private var browser: NetServiceBrowser?
  private var delegate: BrowserDelegate?

  public func definition() -> ModuleDefinition {
    Name("ServiceDiscovery")

    Events("onServiceFound", "onServiceLost", "onError")

    Function("start") { (type: String) in
      DispatchQueue.main.async { self.start(type: type) }
    }

    Function("stop") {
      DispatchQueue.main.async { self.stop() }
    }

    OnDestroy {
      DispatchQueue.main.async { self.stop() }
    }
  }

  private func start(type: String) {
    stop()
    let delegate = BrowserDelegate(
      onFound: { [weak self] payload in self?.sendEvent("onServiceFound", payload) },
      onLost: { [weak self] name in self?.sendEvent("onServiceLost", ["name": name]) },
      onError: { [weak self] message in self?.sendEvent("onError", ["message": message]) }
    )
    let browser = NetServiceBrowser()
    browser.delegate = delegate
    self.delegate = delegate
    self.browser = browser
    let normalized = type.hasSuffix(".") ? type : type + "."
    browser.searchForServices(ofType: normalized, inDomain: "local.")
  }

  private func stop() {
    browser?.stop()
    browser?.delegate = nil
    browser = nil
    delegate?.stopAll()
    delegate = nil
  }
}

private final class BrowserDelegate: NSObject, NetServiceBrowserDelegate, NetServiceDelegate {
  private let onFound: ([String: Any]) -> Void
  private let onLost: (String) -> Void
  private let onError: (String) -> Void
  private var services: [NetService] = []

  init(
    onFound: @escaping ([String: Any]) -> Void,
    onLost: @escaping (String) -> Void,
    onError: @escaping (String) -> Void
  ) {
    self.onFound = onFound
    self.onLost = onLost
    self.onError = onError
  }

  func stopAll() {
    services.forEach { $0.stop(); $0.delegate = nil }
    services.removeAll()
  }

  func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
    services.append(service)
    service.delegate = self
    service.resolve(withTimeout: 5)
  }

  func netServiceBrowser(_ browser: NetServiceBrowser, didRemove service: NetService, moreComing: Bool) {
    services.removeAll { $0 == service }
    onLost(service.name)
  }

  func netServiceBrowser(_ browser: NetServiceBrowser, didNotSearch errorDict: [String: NSNumber]) {
    onError("Falha na busca Bonjour (\(errorDict[NetService.errorCode] ?? -1)).")
  }

  func netServiceDidResolveAddress(_ sender: NetService) {
    var addresses: [String] = []
    for data in sender.addresses ?? [] {
      if let ip = Self.ipString(data), !addresses.contains(ip) { addresses.append(ip) }
    }
    addresses.sort { !$0.contains(":") && $1.contains(":") }
    var txt: [String: String] = [:]
    if let record = sender.txtRecordData() {
      for (key, value) in NetService.dictionary(fromTXTRecord: record) {
        txt[key] = String(data: value, encoding: .utf8) ?? ""
      }
    }
    onFound([
      "name": sender.name,
      "host": sender.hostName ?? "",
      "port": sender.port,
      "addresses": addresses,
      "txt": txt,
    ])
  }

  func netService(_ sender: NetService, didNotResolve errorDict: [String: NSNumber]) {}

  private static func ipString(_ data: Data) -> String? {
    data.withUnsafeBytes { (raw: UnsafeRawBufferPointer) -> String? in
      guard let base = raw.baseAddress else { return nil }
      let sa = base.assumingMemoryBound(to: sockaddr.self)
      var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
      let result = getnameinfo(
        sa, socklen_t(data.count), &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST)
      return result == 0 ? String(cString: host) : nil
    }
  }
}
