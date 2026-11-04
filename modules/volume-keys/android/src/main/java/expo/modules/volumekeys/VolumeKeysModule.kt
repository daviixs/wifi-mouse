package expo.modules.volumekeys

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class VolumeKeysModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VolumeKeys")

    Events("onVolumeKey")

    OnCreate {
      VolumeKeysState.emitter = { direction ->
        sendEvent("onVolumeKey", mapOf("direction" to direction))
      }
    }

    OnDestroy {
      VolumeKeysState.enabled = false
      VolumeKeysState.emitter = null
    }

    Function("setEnabled") { enabled: Boolean ->
      VolumeKeysState.enabled = enabled
    }

    Function("isEnabled") {
      VolumeKeysState.enabled
    }
  }
}
