export const DISCOVERY_SERVICE_TYPE = '_remotemouse._tcp';
export const DISCOVERY_EMPTY_AFTER_MS = 5_000;

export type ComputerOs = 'macos' | 'windows' | 'linux' | 'unknown';

export type RawDiscoveredService = {
  name?: string | null;
  host?: string | null;
  port?: number | null;
  addresses?: (string | null | undefined)[] | null;
  txt?: Record<string, string | null | undefined> | null;
};

export type DiscoveredComputer = {
  /** DNS-SD instance name; unique per service type on the network. */
  id: string;
  name: string;
  ip: string;
  port: number;
  os: ComputerOs;
  version: string | null;
};

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isUsableIpv4(address: string): boolean {
  const match = IPV4.exec(address);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) return false;
  // Skip loopback, link-local (169.254/16) and unspecified addresses.
  if (octets[0] === 127 || octets[0] === 0) return false;
  if (octets[0] === 169 && octets[1] === 254) return false;
  return true;
}

/** Picks the address to connect to: the first usable IPv4 (the agent only listens on IPv4). */
export function pickIpv4Address(addresses: readonly (string | null | undefined)[]): string | null {
  for (const raw of addresses) {
    // Android sometimes reports "/192.168.1.5"; IPv4-mapped IPv6 is also accepted.
    const address = (raw ?? '')
      .trim()
      .replace(/^\//, '')
      .replace(/^::ffff:/i, '');
    if (isUsableIpv4(address)) return address;
  }
  return null;
}

export function parseOs(value: string | null | undefined): ComputerOs {
  const os = (value ?? '').trim().toLowerCase();
  if (os === 'macos' || os === 'mac' || os === 'darwin') return 'macos';
  if (os === 'windows' || os === 'win') return 'windows';
  if (os === 'linux') return 'linux';
  return 'unknown';
}

/** Converts a native resolve event into a computer, or null if it has no usable IPv4. */
export function parseDiscoveredService(raw: RawDiscoveredService): DiscoveredComputer | null {
  const id = (raw.name ?? '').trim();
  if (!id) return null;
  const ip = pickIpv4Address([...(raw.addresses ?? []), raw.host ?? null]);
  if (!ip) return null;
  const txt = raw.txt ?? {};
  const name = (txt.name ?? '').trim() || id;
  const port = typeof raw.port === 'number' && raw.port > 0 ? raw.port : 8765;
  return { id, name, ip, port, os: parseOs(txt.os), version: txt.version?.trim() || null };
}

/** Inserts or replaces a computer (dedup by instance name, then by IP). */
export function upsertComputer(
  list: readonly DiscoveredComputer[],
  computer: DiscoveredComputer,
): DiscoveredComputer[] {
  const rest = list.filter((item) => item.id !== computer.id && item.ip !== computer.ip);
  return sortComputers([...rest, computer]);
}

export function removeComputer(
  list: readonly DiscoveredComputer[],
  id: string,
): DiscoveredComputer[] {
  return list.filter((item) => item.id !== id);
}

export function sortComputers(list: readonly DiscoveredComputer[]): DiscoveredComputer[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
}

/** Moves the last connected computer (matched by id, then IP) to the top of the list. */
export function withLastComputerFirst(
  list: readonly DiscoveredComputer[],
  last: { id?: string | null; ip: string } | null,
): DiscoveredComputer[] {
  if (!last) return [...list];
  const index = list.findIndex((item) => (last.id && item.id === last.id) || item.ip === last.ip);
  if (index <= 0) return [...list];
  return [list[index], ...list.slice(0, index), ...list.slice(index + 1)];
}
