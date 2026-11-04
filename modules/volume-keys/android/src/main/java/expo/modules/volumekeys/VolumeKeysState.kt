package expo.modules.volumekeys

import android.view.KeyEvent

/**
 * Shared state between the JS module and the activity key handler. While
 * [enabled] is true and JS is listening, the VOLUME_UP/VOLUME_DOWN key events
 * are consumed (the phone volume and its HUD do not change) and forwarded to JS.
 */
object VolumeKeysState {
  @Volatile var enabled: Boolean = false
  @Volatile var emitter: ((String) -> Unit)? = null

  private fun directionOf(keyCode: Int): String? = when (keyCode) {
    KeyEvent.KEYCODE_VOLUME_UP -> "up"
    KeyEvent.KEYCODE_VOLUME_DOWN -> "down"
    else -> null
  }

  /** Returns true when the event was consumed. Key repeats are forwarded too. */
  fun onKeyDown(keyCode: Int): Boolean {
    if (!enabled) return false
    val direction = directionOf(keyCode) ?: return false
    val emit = emitter ?: return false
    emit(direction)
    return true
  }

  fun onKeyUp(keyCode: Int): Boolean {
    if (!enabled || emitter == null) return false
    return directionOf(keyCode) != null
  }
}
