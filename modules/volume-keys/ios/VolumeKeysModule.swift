import AVFoundation
import ExpoModulesCore
import MediaPlayer
import UIKit

/// iOS has no public API to intercept the hardware volume buttons. Best effort:
/// keep an active (mixable) audio session, observe `outputVolume`, emit the
/// direction of each change and put the phone volume back with a hidden
/// MPVolumeView slider. At 0% / 100% the volume is first nudged to the middle so
/// both directions keep producing changes. The system volume HUD is hidden while
/// the off-screen MPVolumeView is in the window.
public class VolumeKeysModule: Module {
  private var observation: NSKeyValueObservation?
  private var volumeView: MPVolumeView?
  private var baseline: Float = 0.5
  private var resetting = false
  private var enabled = false

  public func definition() -> ModuleDefinition {
    Name("VolumeKeys")

    Events("onVolumeKey")

    Function("setEnabled") { (enabled: Bool) in
      DispatchQueue.main.async { enabled ? self.start() : self.stop() }
    }

    Function("isEnabled") { self.enabled }

    OnDestroy {
      DispatchQueue.main.async { self.stop() }
    }
  }

  private func start() {
    guard !enabled else { return }
    enabled = true
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.ambient, options: [.mixWithOthers])
    try? session.setActive(true)

    let view = MPVolumeView(frame: CGRect(x: -2000, y: -2000, width: 1, height: 1))
    view.alpha = 0.01
    view.isUserInteractionEnabled = false
    keyWindow()?.addSubview(view)
    volumeView = view

    baseline = clampBaseline(session.outputVolume)
    if baseline != session.outputVolume { setSystemVolume(baseline) }

    observation = session.observe(\.outputVolume, options: [.new]) { [weak self] _, change in
      guard let self, let value = change.newValue else { return }
      DispatchQueue.main.async { self.handle(value) }
    }
  }

  private func stop() {
    guard enabled else { return }
    enabled = false
    observation?.invalidate()
    observation = nil
    volumeView?.removeFromSuperview()
    volumeView = nil
  }

  private func handle(_ value: Float) {
    if resetting {
      if abs(value - baseline) < 0.001 { resetting = false }
      return
    }
    if abs(value - baseline) < 0.001 { return }
    sendEvent("onVolumeKey", ["direction": value > baseline ? "up" : "down"])
    setSystemVolume(baseline)
  }

  private func clampBaseline(_ value: Float) -> Float {
    return (value <= 0.0625 || value >= 0.9375) ? 0.5 : value
  }

  private func setSystemVolume(_ value: Float) {
    guard let slider = volumeView?.subviews.compactMap({ $0 as? UISlider }).first else { return }
    resetting = true
    slider.value = value
    slider.sendActions(for: .valueChanged)
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { self.resetting = false }
  }

  private func keyWindow() -> UIWindow? {
    return UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
  }
}
