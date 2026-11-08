import AppKit
import Combine
import SwiftUI

private enum Theme {
    static let text = Color(red: 0.96, green: 0.97, blue: 1)
    static let muted = Color(red: 0.66, green: 0.71, blue: 0.90)
    static let blue = Color(red: 0.24, green: 0.48, blue: 1)
    static let green = Color(red: 0.18, green: 0.82, blue: 0.48)
    static let border = Color(red: 0.51, green: 0.61, blue: 1).opacity(0.28)
    static let card = LinearGradient(colors: [Color(red: 0.19, green: 0.26, blue: 0.67).opacity(0.45),
                                             Color(red: 0.09, green: 0.12, blue: 0.36).opacity(0.55)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing)
}

@MainActor
struct ServerPanel: View {
    @ObservedObject var model: AgentController

    var body: some View {
        Group {
            // Replace, rather than dim, the dashboard. No dashboard text is
            // composited behind the permission screen, including during scrolling.
            if model.permissionBlocked { permissionOverlay } else { content }
        }
        .frame(width: 380, height: 720)
        .background(LinearGradient(colors: [Color(red: 0.04, green: 0.10, blue: 0.42),
                                             Color(red: 0.03, green: 0.06, blue: 0.27),
                                             Color(red: 0.02, green: 0.04, blue: 0.17)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing))
        .foregroundStyle(Theme.text)
        .environment(\.colorScheme, .dark)
        .onAppear { model.refreshPermission() }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            model.refreshPermission()
        }
    }

    private var content: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 18) {
                header
                illustration
                VStack(spacing: 6) {
                    Text(model.title).font(.system(size: 24, weight: .bold))
                    Text(model.detail).font(.system(size: 13))
                        .foregroundStyle(Theme.muted).multilineTextAlignment(.center)
                        .textSelection(.enabled)
                }
                networkCard
                permissionCard
                HStack(spacing: 10) {
                    Button(action: model.copyAddress) {
                        Label(L10n.text(model.copied ? "button.copied" : "button.copy"), systemImage: model.copied ? "checkmark" : "doc.on.doc")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(model.address == nil || model.phase != .running)
                    Button(action: model.openNetworkSettings) {
                        Image(systemName: "wifi").frame(width: 28)
                    }
                    .help(L10n.text("button.network"))
                    .accessibilityLabel(L10n.text("button.network"))
                }
                .buttonStyle(PanelButtonStyle())
                Button {
                    if model.phase == .running { model.stop() } else { model.start() }
                } label: {
                    HStack(spacing: 8) {
                        if model.busy { ProgressView().controlSize(.small) }
                        Image(systemName: model.phase == .running ? "stop.circle" : "power")
                        Text(L10n.text(model.phase == .running ? "button.stop" : "button.start"))
                            .fontWeight(.semibold)
                    }.frame(maxWidth: .infinity)
                }
                .buttonStyle(PanelButtonStyle(primary: true))
                .disabled(model.busy)
                Text(L10n.text("connection.help"))
                    .font(.system(size: 11)).foregroundStyle(Theme.muted)
                    .multilineTextAlignment(.center)
                HStack {
                    Text("REMOTE MOUSE · macOS").font(.system(size: 9, weight: .medium)).tracking(1)
                    Spacer()
                    Button(L10n.text("button.quit")) { NSApplication.shared.terminate(nil) }
                        .buttonStyle(.plain).keyboardShortcut("q")
                        .accessibilityHint(L10n.text("hint.quit"))
                }.foregroundStyle(Theme.muted)
            }
            .padding(24)
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            Image(systemName: "wifi").font(.system(size: 19, weight: .semibold))
                .frame(width: 40, height: 40)
                .background(LinearGradient(colors: [.cyan, Theme.blue], startPoint: .topLeading, endPoint: .bottomTrailing))
                .clipShape(RoundedRectangle(cornerRadius: 11))
            (Text("REMOTE ").bold() + Text("MOUSE")).font(.system(size: 12)).tracking(1)
            Spacer()
            Image(systemName: "desktopcomputer").foregroundStyle(Theme.muted)
        }
    }

    private var illustration: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 24).fill(Theme.card)
            Ellipse().stroke(Theme.blue.opacity(0.35), lineWidth: 1)
                .frame(width: 220, height: 65).rotationEffect(.degrees(-12)).offset(y: 20)
            Image(systemName: "laptopcomputer").font(.system(size: 86, weight: .light))
                .foregroundStyle(LinearGradient(colors: [Color(red: 0.55, green: 0.78, blue: 1), Theme.blue],
                                                 startPoint: .topLeading, endPoint: .bottomTrailing))
                .shadow(color: Theme.blue.opacity(0.5), radius: 20, y: 8)
            Image(systemName: "cursorarrow").font(.system(size: 24, weight: .semibold)).offset(y: -5)
            if model.phase == .running && model.helperTrusted == true {
                Image(systemName: model.clientConnected ? "checkmark" : "wifi")
                    .font(.system(size: 14, weight: .bold)).padding(10)
                    .background(Theme.green).clipShape(Circle()).offset(x: 65, y: -30)
            }
        }
        .frame(height: 140)
        .accessibilityHidden(true)
    }

    private var networkCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Label(model.computerName, systemImage: "laptopcomputer")
                    .font(.system(size: 13, weight: .semibold)).lineLimit(1)
                Spacer()
                Circle().fill(model.phase == .running ? Theme.green : Theme.muted).frame(width: 6, height: 6)
                Text(L10n.text(model.phase == .running ? "network.online" : "network.offline")).font(.system(size: 11))
            }
            if model.addresses.isEmpty {
                Text(L10n.text(model.phase == .running ? "network.noip" : "network.wait"))
                    .font(.system(size: 12)).foregroundStyle(Theme.muted)
            } else {
                ForEach(model.addresses, id: \.self) { ip in
                    Text("\(ip):\(model.port)").font(.system(size: 15, weight: .medium, design: .monospaced))
                        .textSelection(.enabled)
                }
            }
            if model.phase == .running {
                Text(L10n.text(model.mdns ? "network.discovery" : "network.manual"))
                    .font(.system(size: 11)).foregroundStyle(Theme.muted)
                Text(L10n.text(model.clientConnected ? "network.connected" : "network.waiting"))
                    .font(.system(size: 11)).foregroundStyle(Theme.muted)
            }
        }.frame(maxWidth: .infinity, alignment: .leading).panelCard()
    }

    private var permissionCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(L10n.text("permission.title"), systemImage: "hand.raised")
                .font(.system(size: 12, weight: .semibold))
            Text(permissionText).font(.system(size: 11)).foregroundStyle(Theme.muted)
            if model.permissionBlocked {
                Button(L10n.text("button.accessibility"), action: model.openAccessibility)
                    .font(.system(size: 12, weight: .medium)).buttonStyle(.plain).foregroundStyle(.cyan)
            }
        }.frame(maxWidth: .infinity, alignment: .leading).panelCard()
    }

    private var permissionText: String {
        model.helperTrusted == true ? L10n.text("permission.allowed") : model.permissionMessage
    }

    /// Not dismissible: the dashboard is absent from the render/VoiceOver tree.
    /// Settings, Finder and Quit remain accessible even while probing or stopping.
    private var permissionOverlay: some View {
        VStack(spacing: 0) {
            ScrollView(showsIndicators: true) {
                VStack {
                    VStack(spacing: 16) {
                        Image(systemName: "hand.raised.fill")
                            .font(.system(size: 42)).foregroundStyle(.cyan)
                            .accessibilityHidden(true)
                        Text(L10n.text("permission.required"))
                            .font(.system(size: 23, weight: .bold))
                            .multilineTextAlignment(.center)
                        if model.helperTrusted == nil && model.accessibility.problem == nil {
                            ProgressView().controlSize(.small)
                        }
                        Text(model.permissionMessage)
                            .font(.system(size: 13)).multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                        if model.accessibility.problem != nil || model.helperTrusted == nil {
                            Text(L10n.text("permission.explanation"))
                                .font(.system(size: 12)).foregroundStyle(Theme.muted)
                                .multilineTextAlignment(.center)
                        }
                        Button(action: model.openAccessibility) {
                            Text(L10n.text("button.accessibility")).frame(maxWidth: .infinity)
                        }
                        .buttonStyle(PanelButtonStyle(primary: true))
                        .keyboardShortcut(.defaultAction)
                        .disabled(model.permissionChecking)
                        Button(L10n.text("button.recheck")) { model.refreshPermission() }
                            .buttonStyle(PanelButtonStyle())
                            .disabled(model.permissionChecking)
                        Divider().overlay(Theme.border)
                        Text(L10n.text("permission.helper.help"))
                            .font(.system(size: 11)).foregroundStyle(Theme.muted)
                            .multilineTextAlignment(.center)
                        Button(action: model.showHelper) {
                            Label(L10n.text("button.helper"), systemImage: "folder")
                                .frame(maxWidth: .infinity)
                        }.buttonStyle(PanelButtonStyle())
                        Button(L10n.text("button.permission.diagnostic"), action: model.copyPermissionDiagnostics)
                            .buttonStyle(PanelButtonStyle())
                        Text(L10n.text("permission.automatic"))
                            .font(.system(size: 11)).foregroundStyle(Theme.muted)
                            .multilineTextAlignment(.center)
                    }
                    .padding(18)
                    .frame(maxWidth: .infinity)
                    .background(Color(red: 0.08, green: 0.12, blue: 0.25))
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border))
                    .accessibilityElement(children: .contain)
                }
                .frame(maxWidth: .infinity)
                .padding(20)
            }
            // Outside the scroll region: Quit remains visible with long translations.
            Button(L10n.text("button.quit")) { NSApplication.shared.terminate(nil) }
                .buttonStyle(.plain).keyboardShortcut("q")
                .accessibilityHint(L10n.text("hint.quit"))
                .frame(maxWidth: .infinity)
                .padding(.top, 8).padding(.bottom, 16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.03, green: 0.05, blue: 0.12))
        .contentShape(Rectangle())
    }

}

private struct PanelButtonStyle: ButtonStyle {
    var primary = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.system(size: 12)).padding(.vertical, 13).padding(.horizontal, 12)
            .background {
                if primary {
                    LinearGradient(colors: [Color(red: 0.10, green: 0.30, blue: 0.70),
                                            Color(red: 0.14, green: 0.25, blue: 0.62),
                                            Color(red: 0.25, green: 0.18, blue: 0.62)],
                                   startPoint: .leading, endPoint: .trailing)
                } else { Theme.card }
            }
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.border))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

private extension View {
    func panelCard() -> some View {
        padding(15).background(Theme.card).clipShape(RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.border))
    }
}
