package expo.modules.volumekeys

import android.content.Context
import android.view.KeyEvent
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityHandler

/**
 * Hooks into Expo's ReactActivityDelegateWrapper key callbacks, so no
 * MainActivity edits (and no config plugin) are needed.
 */
class VolumeKeysPackage : Package {
  override fun createReactActivityHandlers(activityContext: Context): List<ReactActivityHandler> =
    listOf(object : ReactActivityHandler {
      override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean =
        VolumeKeysState.onKeyDown(keyCode)

      override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean =
        VolumeKeysState.onKeyUp(keyCode)

      override fun onKeyLongPress(keyCode: Int, event: KeyEvent?): Boolean =
        VolumeKeysState.onKeyUp(keyCode)
    })
}
