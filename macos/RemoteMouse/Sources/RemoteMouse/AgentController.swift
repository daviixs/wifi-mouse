import AppKit
import ApplicationServices
import Combine
import Foundation

@MainActor
final class AgentController: ObservableObject {
    enum Phase { case stopped, starting, running, stopping, failed }
    @Published private(set) var phase: Phase = .stopped
    @Published private(set) var clientConnected = false
    @Published private(set) var helperTrusted: Bool? = nil
    @Published private(set) var appTrusted = false
    @Published private(set) var addresses: [String] = []
    @Published private(set) var port: UInt16 = 8765
    @Published private(set) var computerName = Host.current().localizedName ?? "Meu Mac"
    @Published private(set) var mdns = false
    @Published private(set) var detail = "Inicie o servidor para conectar seu celular."
    @Published private(set) var copied = false

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
        case .stopped: return "Seu Mac, sem fios."
        case .starting: return "Iniciando…"
        case .stopping: return "Encerrando…"
        case .failed: return "Vamos tentar de novo?"
        case .running:
            if helperTrusted != true { return "Permissão necessária" }
            return clientConnected ? "Conectado!" : "Pronto para conectar!"
        }
    }
    var address: String? { addresses.first.map { "ws://\($0):\(port)" } }

    init() {
        refreshPermission()
        timer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.refreshPermission()
                if self?.phase == .running { self?.send("status") }
            }
        }
    }

    func refreshPermission() { appTrusted = AXIsProcessTrustedWithOptions(nil) }

    func openAccessibility() {
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        _ = AXIsProcessTrustedWithOptions(options)
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
        guard process == nil else { return }
        guard let executable = Bundle.main.executableURL?.deletingLastPathComponent()
            .appendingPathComponent("remote-mouse-agent"),
            FileManager.default.isExecutableFile(atPath: executable.path) else {
            phase = .failed
            detail = "Agente ausente. Gere o aplicativo com macos/scripts/build-app.sh."
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
        lastError = ""; pendingFailure = nil; helperTrusted = nil; clientConnected = false
        addresses = []; mdns = false
        phase = .starting; detail = "Preparando a conexão com seu celular…"

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
            phase = .failed; detail = "Não foi possível abrir o agente: \(error.localizedDescription)"
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 12) { [weak self, weak task] in
            guard let self, let task, self.process === task, self.phase == .starting else { return }
            self.stop(failure: "O agente não confirmou a inicialização. Verifique Acessibilidade e a porta 8765.")
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
            helperTrusted = trusted; self.mdns = mdns
            phase = .running
            detail = "Abra o Remote Mouse no celular e escolha este Mac."
        case "permission":
            helperTrusted = event.accessibility
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
                ? "O agente encerrou (código \(task.terminationStatus)). Verifique a porta 8765 e as permissões."
                : "Falha no agente: \(error)"
        } else if shutdownCompletion == nil {
            detail = "Servidor parado. Seu Mac não está recebendo comandos."
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
        clientConnected = false; helperTrusted = nil; mdns = false; addresses = []
    }

    func copyAddress() {
        guard let address, phase == .running else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(address, forType: .string)
        copied = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in self?.copied = false }
    }
}
