import { APP_CONFIG } from '../../constants/config';

export function isValidIpv4Address(address: string): boolean {
  const octets = address.trim().split('.');
  return (
    octets.length === 4 && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
  );
}

export type ServerAddress = { host: string; port: number; address: string; url: string };

/** IPv4 or DNS host with optional port. No credentials, arbitrary paths or IPv6. */
export function parseServerAddress(input: string): ServerAddress | null {
  const text = input
    .trim()
    .replace(/^ws:\/\//i, '')
    .replace(/\/$/, '');
  const match = /^([^:\s/\?#@]+)(?::(\d{1,5}))?$/.exec(text);
  if (!match) return null;
  const host = match[1].toLowerCase();
  if (/^[\d.]+$/.test(host)) {
    if (!isValidIpv4Address(host)) return null;
  } else if (
    host.length > 253 ||
    !host
      .split('.')
      .every((label) => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
  )
    return null;
  const port = match[2] === undefined ? APP_CONFIG.agentPort : Number(match[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  const address = `${host}:${port}`;
  return { host, port, address, url: `ws://${address}` };
}

export function createServerUrl(address: string): string {
  const parsed = parseServerAddress(address);
  if (!parsed) throw new Error('Endereço inválido. Use IP ou nome do computador e porta opcional.');
  return parsed.url;
}
