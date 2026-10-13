import { APP_CONFIG } from '../../constants/config';

export function isValidIpv4Address(address: string): boolean {
  const octets = address.trim().split('.');
  return (
    octets.length === 4 &&
    octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) >= 0 && Number(octet) <= 255)
  );
}

export function createServerUrl(address: string): string {
  const normalizedAddress = address.trim();
  if (!isValidIpv4Address(normalizedAddress)) {
    throw new Error('Endereço IPv4 inválido.');
  }

  return `ws://${normalizedAddress}:${APP_CONFIG.agentPort}`;
}
