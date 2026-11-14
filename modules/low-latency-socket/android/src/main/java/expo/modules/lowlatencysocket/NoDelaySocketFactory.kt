package expo.modules.lowlatencysocket

import java.net.InetAddress
import java.net.Socket
import javax.net.SocketFactory

/** Wraps the default factory and turns on TCP_NODELAY for every socket it creates. */
internal class NoDelaySocketFactory(
  private val delegate: SocketFactory = SocketFactory.getDefault(),
) : SocketFactory() {
  private fun Socket.noDelay(): Socket = apply {
    try {
      tcpNoDelay = true
    } catch (_: Throwable) {
      // Best effort: keep the socket usable even if the option is refused.
    }
  }

  override fun createSocket(): Socket = delegate.createSocket().noDelay()

  override fun createSocket(host: String?, port: Int): Socket =
    delegate.createSocket(host, port).noDelay()

  override fun createSocket(host: String?, port: Int, localHost: InetAddress?, localPort: Int): Socket =
    delegate.createSocket(host, port, localHost, localPort).noDelay()

  override fun createSocket(host: InetAddress?, port: Int): Socket =
    delegate.createSocket(host, port).noDelay()

  override fun createSocket(address: InetAddress?, port: Int, localAddress: InetAddress?, localPort: Int): Socket =
    delegate.createSocket(address, port, localAddress, localPort).noDelay()
}
