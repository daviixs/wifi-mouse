import AppKit
import ApplicationServices
import Combine
import Foundation

@MainActor
final class AgentController: ObservableObject {
    enum Phase { case stopped, starting, running, stopping, failed }
    @Published private(set) var phase: Phase = .stopped
    @Published private(set) var clientConnected = false
    @Published private(set) var accessibility = AccessibilityState()
    var helperTrusted: Bool? { accessibility.trusted }
    var permissionBlocked: Bool { accessibility.isBlocking }
    var permissionMessage: String {
        accessibility.problem ?? L10n.text(helperTrusted == nil ? "permission.checking" : "permission.explanation")
    }
    @Published private(set) var addresses: [String] = []
    @Published private(set) var port: UInt16 = 8765
    @Published private(set) var computerName = Host.current().localizedName ?? L10n.text("name.mac")
    @Published private(set) var mdns = false
    @Published private(set) var detail = L10n.text("detail.idle")
    @Published private(set) var copied = false

    private var permissionProbe: Process?
    private var probeOutput: Pipe?
    private var probeTimedOut = false
    private var pendingPrompt = false
    private var quitting = false
    private var process: Process?
    private var input: Pipe?
    private var output: Pipe?
    private var errors: Pipe?
    private var timer: Timer?
    private var lastError = ""
    private var pendingFailure: String?
    private var shutdownCompletion: (() -> Void)?

    var busy: Bool { phase == .starting || phase == .stopping }
    var title: String {
        switch phase {
        case .stopped: return L10n.text("title.idle")
        case .starting: return L10n.text("title.starting")
        case .stopping: return L10n.text("title.stopping")
        case .failed: return L10n.text("title.failed")
        case .running:
            if helperTrusted != true { return L10n.text("title.permission") }
            return L10n.text(clientConnected ? "title.connected" : "title.ready")
        }
    }
    var address: String? { addresses.first.map { "ws://\($0):\(port)" } }

    init() {
        refreshPermission()
        timer = Timer(timeInterval: 2, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.refreshPermission()
                if self?.phase == .running { self?.send("status") }
            }
        }
        if let timer { RunLoop.main.add(timer, forMode: .common) }
    }

    private var helperExecutable: URL? {
        guard let executable = Bundle.main.executableURL?.deletingLastPathComponent()
            .appendingPathComponent("remote-mouse-agent"),
              FileManager.default.isExecutableFile(atPath: executable.path) else { return nil }
        return executable
    }

    /// A fresh check-only process avoids stale TCC state and works before server startup.
    /// It never binds a socket, advertises mDNS, constructs Enigo or injects input.
    func refreshPermission(prompt: Bool = false) {
        guard !quitting else { return }
        guard permissionProbe == nil else {
            pendingPrompt = pendingPrompt || prompt
            return
        }
        guard let executable = helperExecutable else {
            updatePermission(nil, problem: L10n.text("error.missing"))
            return
        }
        let task = Process(), stdout = Pipe()
        task.executableURL = executable
        task.arguments = [prompt ? "--request-accessibility" : "--check-accessibility"]
        // A mismatched older helper must fail parsing instead of starting a server.
        var environment = ProcessInfo.processInfo.environment
        environment["REMOTE_MOUSE_BIND"] = "permission-check-only"
        task.environment = environment
        task.standardInput = FileHandle.nullDevice
        task.standardOutput = stdout
        task.standardError = FileHandle.nullDevice
        permissionProbe = task; probeOutput = stdout; probeTimedOut = false
        task.terminationHandler = { [weak self] task in
            // Check-only output is one small JSON line. Drain only after termination,
            // off the UI thread, so EOF cannot race the event reader of the server.
            let data = (try? stdout.fileHandleForReading.readToEnd()) ?? Data()
            try? stdout.fileHandleForReading.close()
            DispatchQueue.main.async { self?.finishPermissionProbe(task, data: data) }
        }
        do {
            try task.run()
            try? stdout.fileHandleForWriting.close()
        } catch {
            try? stdout.fileHandleForReading.close()
            try? stdout.fileHandleForWriting.close()
            permissionProbe = nil; probeOutput = nil
            updatePermission(nil, problem: L10n.text("error.launch", error.localizedDescription))
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self, weak task] in
            guard let self, let task, self.permissionProbe === task, task.isRunning else { return }
            self.probeTimedOut = true
            self.updatePermission(nil, problem: L10n.text("error.probe.timeout"))
            task.terminate() // only this owned, finite check process
        }
    }

    private func finishPermissionProbe(_ task: Process, data: Data) {
        guard permissionProbe === task else { return }
        permissionProbe = nil; probeOutput = nil
        guard !quitting else { return }
        if probeTimedOut {
            updatePermission(nil, problem: L10n.text("error.probe.timeout"))
        } else {
            let event = String(decoding: data.prefix(4096), as: UTF8.self)
                .split(separator: "\n").compactMap { AgentEvent.parse(String($0)) }
                .first { $0.event == "permission" }
            if task.terminationStatus == 0, let trusted = event?.accessibility {
                updatePermission(trusted)
            } else {
                updatePermission(nil, problem: L10n.text("error.probe"))
            }
        }
        if pendingPrompt {
            pendingPrompt = false
            refreshPermission(prompt: true)
        }
    }

    private func updatePermission(_ trusted: Bool?, problem: String? = nil) {
        accessibility.confirm(trusted, problem: problem)
        if trusted != true, process != nil, phase != .stopping {
            stop(failure: L10n.text("detail.revoked"))
        }
    }

    func showHelper() {
        guard let executable = helperExecutable else { return }
        NSWorkspace.shared.activateFileViewerSelecting([executable])
    }

    func openAccessibility() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(options)
        refreshPermission(prompt: true)
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
            NSWorkspace.shared.open(url)
        }
    }

    func openNetworkSettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.Network-Settings.extension") {
            NSWorkspace.shared.open(url)
        }
    }

    func start() {
        guard process == nil, !permissionBlocked, !quitting else { return }
        guard let executable = helperExecutable else {
            phase = .failed
            detail = L10n.text("error.missing")
            return
        }
        let task = Process()
        let stdin = Pipe(), stdout = Pipe(), stderr = Pipe()
        task.executableURL = executable
        var environment = ProcessInfo.processInfo.environment
        environment["REMOTE_MOUSE_DESKTOP"] = "1"
        environment["REMOTE_MOUSE_BIND"] = "0.0.0.0:8765"
        task.environment = environment
        task.standardInput = stdin
        task.standardOutput = stdout
        task.standardError = stderr
        input = stdin; output = stdout; errors = stderr; process = task
        lastError = ""; pendingFailure = nil; clientConnected = false
        addresses = []; mdns = false
        phase = .starting; detail = L10n.text("detail.starting")

        // A dedicated serial reader preserves line order and never blocks the UI.
        let reader = AgentOutputReader()
        stdout.fileHandleForReading.readabilityHandler = { [weak self, weak task] handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil; return }
            reader.append(data) { [weak self, weak task] event in
                DispatchQueue.main.async { [weak self, weak task] in
                    guard let self, let task, self.process === task, task.isRunning else { return }
                    self.receive(event)
                }
            }
        }
        stderr.fileHandleForReading.readabilityHandler = { [weak self, weak task] handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil; return }
            DispatchQueue.main.async { [weak self, weak task] in
                guard let self, let task, self.process === task else { return }
                self.lastError = String((self.lastError + String(decoding: data, as: UTF8.self)).suffix(4000))
            }
        }
        task.terminationHandler = { [weak self] task in
            DispatchQueue.main.async { self?.finished(task) }
        }
        do {
            try task.run()
            // Close the parent's duplicate child ends so EOF/exit cannot be hidden.
            try? stdin.fileHandleForReading.close()
            try? stdout.fileHandleForWriting.close()
            try? stderr.fileHandleForWriting.close()
        } catch {
            cleanup()
            phase = .failed; detail = L10n.text("error.launch", error.localizedDescription)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 12) { [weak self, weak task] in
            guard let self, let task, self.process === task, self.phase == .starting else { return }
            self.stop(failure: L10n.text("error.timeout"))
        }
    }

    private func receive(_ event: AgentEvent) {
        guard phase != .stopping else { return }
        switch event.event {
        case "ready":
            guard let port = event.port, let addresses = event.addresses,
                  let trusted = event.accessibility, let mdns = event.mdns else { return }
            self.port = port; self.addresses = addresses
            computerName = event.name ?? computerName
            self.mdns = mdns
            if !trusted {
                updatePermission(false)
                return
            }
            phase = .running
            detail = L10n.text("detail.ready")
        case "permission":
            // A denial from the running input process is authoritative. A success
            // cannot override a newer denied/failed fresh permission probe.
            if event.accessibility == false { updatePermission(false) }
            if let addresses = event.addresses { self.addresses = addresses }
        case "client": clientConnected = event.connected ?? false
        default: break
        }
    }

    private func send(_ command: String) {
        guard let task = process, task.isRunning, let handle = input?.fileHandleForWriting else { return }
        // Tiny private messages only; write errors are handled by process termination.
        try? handle.write(contentsOf: Data("\(command)\n".utf8))
    }

    func stop(failure: String? = nil) {
        guard let task = process else { return }
        pendingFailure = failure
        phase = .stopping
        send("stop")
        try? input?.fileHandleForWriting.close()
        // Only signal the exact Process we launched, never pgrep/killall or another server.
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self, weak task] in
            guard let self, let task, self.process === task, task.isRunning else { return }
            task.interrupt()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self, weak task] in
            guard let self, let task, self.process === task, task.isRunning else { return }
            task.terminate()
        }
    }

    func quit(completion: @escaping () -> Void) {
        quitting = true
        timer?.invalidate()
        if let task = permissionProbe, task.isRunning { task.terminate() }
        guard process != nil else { completion(); return }
        shutdownCompletion = completion
        stop()
    }

    private func finished(_ task: Process) {
        guard process === task else { return }
        let requested = phase == .stopping
        let error = lastError.trimmingCharacters(in: .whitespacesAndNewlines)
        let failure = pendingFailure
        pendingFailure = nil
        cleanup()
        phase = requested && failure == nil ? .stopped : .failed
        if let failure {
            detail = failure
        } else if !requested {
            detail = error.isEmpty
                ? L10n.text("error.exited", task.terminationStatus)
                : L10n.text("error.agent", error)
        } else if shutdownCompletion == nil {
            detail = L10n.text("detail.stopped")
        }
        let completion = shutdownCompletion
        shutdownCompletion = nil
        completion?()
    }

    private func cleanup() {
        output?.fileHandleForReading.readabilityHandler = nil
        errors?.fileHandleForReading.readabilityHandler = nil
        try? input?.fileHandleForWriting.close()
        try? input?.fileHandleForReading.close()
        try? output?.fileHandleForReading.close()
        try? output?.fileHandleForWriting.close()
        try? errors?.fileHandleForReading.close()
        try? errors?.fileHandleForWriting.close()
        process = nil; input = nil; output = nil; errors = nil
        clientConnected = false; mdns = false; addresses = []
    }

    func copyAddress() {
        guard let address, phase == .running else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(address, forType: .string)
        copied = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in self?.copied = false }
    }
}
