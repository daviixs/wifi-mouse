package expo.modules.lowlatencysocket

import android.app.Application
import android.content.Context
import android.util.Log
import com.facebook.react.modules.websocket.WebSocketModule
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

/**
 * React Native's Android WebSocket (OkHttp) leaves Nagle's algorithm on, so each tiny
 * `mouse.move` frame waits for the ACK of the previous one. With the phone's Wi-Fi power
 * save delaying those ACKs and the computer's delayed ACK (up to ~200 ms on Windows), the
 * cursor moves in bursts. iOS does not show this. Registered at Application.onCreate,
 * before any JS can open a socket; no MainApplication edits needed.
 */
class LowLatencySocketPackage : Package {
  override fun createApplicationLifecycleListeners(context: Context): List<ApplicationLifecycleListener> =
    listOf(object : ApplicationLifecycleListener {
      override fun onCreate(application: Application) {
        try {
          WebSocketModule.setCustomClientBuilder { builder ->
            builder.socketFactory(NoDelaySocketFactory())
          }
        } catch (error: Throwable) {
          // Never block app start for a latency tweak.
          Log.w("LowLatencySocket", "Could not enable TCP_NODELAY for WebSockets", error)
        }
      }
    })
}
