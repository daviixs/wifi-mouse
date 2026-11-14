package expo.modules.servicediscovery

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * DNS-SD browsing with the platform NsdManager (backed by the system mDNS
 * responder, so no MulticastLock is strictly needed; one is held while browsing
 * anyway for OEM builds that filter multicast). Resolves are serialized because
 * NsdManager.resolveService allows only one in flight on older Android versions.
 */
class ServiceDiscoveryModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private var nsd: NsdManager? = null
  private var discoveryListener: NsdManager.DiscoveryListener? = null
  private var multicastLock: WifiManager.MulticastLock? = null
  private val resolveQueue = ArrayDeque<NsdServiceInfo>()
  private var resolving = false
  @Volatile private var generation = 0

  override fun definition() = ModuleDefinition {
    Name("ServiceDiscovery")

    Events("onServiceFound", "onServiceLost", "onError")

    Function("start") { type: String -> main.post { start(type) } }

    Function("stop") { main.post { stop() } }

    OnDestroy {
      // Invalidate callbacks already queued on the main looper before stop() runs, so
      // nothing is emitted into a torn-down JS runtime (reload / activity recreation).
      generation++
      main.post { stop() }
    }
  }

  private val context: Context?
    get() = appContext.reactContext?.applicationContext

  private fun start(type: String) {
    stop()
    val ctx = context ?: return emitError("Contexto Android indisponível.")
    val manager = ctx.getSystemService(Context.NSD_SERVICE) as? NsdManager
      ?: return emitError("NsdManager indisponível.")
    nsd = manager
    acquireMulticastLock(ctx)
    val current = ++generation
    val listener = object : NsdManager.DiscoveryListener {
      override fun onDiscoveryStarted(serviceType: String) {}
      override fun onDiscoveryStopped(serviceType: String) {}
      override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
        main.post { if (current == generation) emitError("Falha ao iniciar a busca ($errorCode).") }
      }
      override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
      override fun onServiceFound(info: NsdServiceInfo) {
        main.post { if (current == generation) enqueueResolve(info) }
      }
      override fun onServiceLost(info: NsdServiceInfo) {
        main.post {
          if (current == generation) safeSend("onServiceLost", mapOf("name" to info.serviceName))
        }
      }
    }
    discoveryListener = listener
    try {
      manager.discoverServices(type, NsdManager.PROTOCOL_DNS_SD, listener)
    } catch (error: Throwable) {
      discoveryListener = null
      emitError(error.message ?: "Falha ao iniciar a busca.")
    }
  }

  private fun stop() {
    generation++
    resolveQueue.clear()
    resolving = false
    discoveryListener?.let { listener ->
      try {
        nsd?.stopServiceDiscovery(listener)
      } catch (_: Throwable) {
      }
    }
    discoveryListener = null
    multicastLock?.let { if (it.isHeld) it.release() }
    multicastLock = null
  }

  private fun acquireMulticastLock(ctx: Context) {
    try {
      val wifi = ctx.getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return
      multicastLock = wifi.createMulticastLock("remote-mouse-discovery").apply {
        setReferenceCounted(false)
        acquire()
      }
    } catch (_: Throwable) {
      multicastLock = null
    }
  }

  private fun enqueueResolve(info: NsdServiceInfo) {
    resolveQueue.addLast(info)
    resolveNext()
  }

  @Suppress("DEPRECATION")
  private fun resolveNext() {
    val manager = nsd ?: return
    if (resolving) return
    val next = resolveQueue.removeFirstOrNull() ?: return
    resolving = true
    val current = generation
    try {
      manager.resolveService(next, object : NsdManager.ResolveListener {
        override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
          main.post {
            if (current != generation) return@post
            resolving = false
            if (errorCode == NsdManager.FAILURE_ALREADY_ACTIVE) resolveQueue.addLast(info)
            main.postDelayed({ if (current == generation) resolveNext() }, 150)
          }
        }

        override fun onServiceResolved(info: NsdServiceInfo) {
          main.post {
            if (current != generation) return@post
            resolving = false
            emitResolved(info)
            resolveNext()
          }
        }
      })
    } catch (_: Throwable) {
      resolving = false
      main.postDelayed({ if (current == generation) resolveNext() }, 150)
    }
  }

  @Suppress("DEPRECATION")
  private fun emitResolved(info: NsdServiceInfo) {
    val addresses = mutableListOf<String>()
    if (android.os.Build.VERSION.SDK_INT >= 34) {
      info.hostAddresses.forEach { address -> address.hostAddress?.let { addresses.add(it) } }
    }
    info.host?.hostAddress?.let { if (!addresses.contains(it)) addresses.add(it) }
    // IPv4 first; JS also filters, this just keeps the payload predictable.
    addresses.sortBy { if (it.contains(':')) 1 else 0 }
    val txt = mutableMapOf<String, String>()
    info.attributes?.forEach { (key, value) ->
      txt[key] = value?.let { String(it, Charsets.UTF_8) } ?: ""
    }
    safeSend(
      "onServiceFound",
      mapOf(
        "name" to info.serviceName,
        "host" to (info.host?.hostAddress ?: ""),
        "port" to info.port,
        "addresses" to addresses,
        "txt" to txt,
      ),
    )
  }

  private fun emitError(message: String) {
    safeSend("onError", mapOf("message" to message))
  }

  /** Discovery is best effort: never let an event into a dead JS runtime crash the app. */
  private fun safeSend(name: String, body: Map<String, Any?>) {
    try {
      sendEvent(name, body)
    } catch (_: Throwable) {
    }
  }
}
