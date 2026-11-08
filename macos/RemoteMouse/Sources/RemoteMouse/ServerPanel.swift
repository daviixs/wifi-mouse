import AppKit
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
        ScrollView {
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
                        Label(model.copied ? "Copiado!" : "Copiar endereço", systemImage: model.copied ? "checkmark" : "doc.on.doc")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(model.address == nil || model.phase != .running)
                    Button(action: model.openNetworkSettings) {
                        Image(systemName: "wifi").frame(width: 28)
                    }
                    .help("Abrir ajustes de rede")
                    .accessibilityLabel("Abrir ajustes de rede")
                }
                .buttonStyle(PanelButtonStyle())
                Button {
                    if model.phase == .running { model.stop() } else { model.start() }
                } label: {
                    HStack(spacing: 8) {
                        if model.busy { ProgressView().controlSize(.small) }
                        Image(systemName: model.phase == .running ? "stop.circle" : "power")
                        Text(model.phase == .running ? "Parar servidor" : "Iniciar servidor")
                            .fontWeight(.semibold)
                    }.frame(maxWidth: .infinity)
                }
                .buttonStyle(PanelButtonStyle(primary: true))
                .disabled(model.busy)
                Text("No celular, use a mesma rede Wi-Fi. O Mac aparece automaticamente; se não aparecer, digite o IP acima. Use apenas redes confiáveis.")
                    .font(.system(size: 11)).foregroundStyle(Theme.muted)
                    .multilineTextAlignment(.center)
                HStack {
                    Text("REMOTE MOUSE · macOS").font(.system(size: 9, weight: .medium)).tracking(1)
                    Spacer()
                    Button("Sair") { NSApplication.shared.terminate(nil) }
                        .buttonStyle(.plain).keyboardShortcut("q")
                        .accessibilityHint("Para o servidor e encerra o aplicativo")
                }.foregroundStyle(Theme.muted)
            }
            .padding(24)
        }
        .frame(width: 380, height: 720)
        .background(LinearGradient(colors: [Color(red: 0.04, green: 0.10, blue: 0.42),
                                             Color(red: 0.03, green: 0.06, blue: 0.27),
                                             Color(red: 0.02, green: 0.04, blue: 0.17)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing))
        .foregroundStyle(Theme.text)
        .environment(\.colorScheme, .dark)
        .onAppear { model.refreshPermission() }
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
                Text(model.phase == .running ? "Online" : "Offline").font(.system(size: 11))
            }
            if model.addresses.isEmpty {
                Text(model.phase == .running ? "Sem IP local. Verifique o Wi-Fi ou as permissões de Rede Local." : "Porta 8765 · aguardando início")
                    .font(.system(size: 12)).foregroundStyle(Theme.muted)
            } else {
                ForEach(model.addresses, id: \.self) { ip in
                    Text("\(ip):\(model.port)").font(.system(size: 15, weight: .medium, design: .monospaced))
                        .textSelection(.enabled)
                }
            }
            if model.phase == .running {
                Text(model.mdns ? "Descoberta automática disponível" : "Descoberta indisponível · conecte pelo IP")
                    .font(.system(size: 11)).foregroundStyle(Theme.muted)
                Text(model.clientConnected ? "Celular conectado por WebSocket" : "Aguardando o celular")
                    .font(.system(size: 11)).foregroundStyle(Theme.muted)
            }
        }.frame(maxWidth: .infinity, alignment: .leading).panelCard()
    }

    private var permissionCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Acessibilidade", systemImage: "hand.raised")
                .font(.system(size: 12, weight: .semibold))
            Text(permissionText).font(.system(size: 11)).foregroundStyle(Theme.muted)
            if !model.appTrusted || model.helperTrusted != true {
                Button("Abrir ajustes de Acessibilidade", action: model.openAccessibility)
                    .font(.system(size: 12, weight: .medium)).buttonStyle(.plain).foregroundStyle(.cyan)
            }
        }.frame(maxWidth: .infinity, alignment: .leading).panelCard()
    }

    private var permissionText: String {
        if model.helperTrusted == true { return "Agente autorizado a controlar mouse e teclado." }
        if model.helperTrusted == false { return "Autorize Remote Mouse (ou remote-mouse-agent) nos ajustes. Depois, pare e inicie o servidor." }
        return "\(model.appTrusted ? "App autorizado." : "App ainda não autorizado.") O estado do agente será verificado ao iniciar."
    }
}

private struct PanelButtonStyle: ButtonStyle {
    var primary = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.system(size: 12)).padding(.vertical, 13).padding(.horizontal, 12)
            .background {
                if primary {
                    LinearGradient(colors: [Color(red: 0.25, green: 0.63, blue: 1), Theme.blue, Color(red: 0.29, green: 0.24, blue: 0.96)],
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
