/**
 * Single source of truth for every outbound link on the landing page.
 *
 * Direct downloads use GitHub's `releases/latest/download/<asset>` URLs, so they
 * always serve the newest release as long as every release keeps the same asset
 * names (ConnectMouse-Windows-Setup.exe, ConnectMouse-macOS.dmg,
 * ConnectMouse-Android.apk). The Windows app is also on the Microsoft Store
 * (product 9MZHLB2RMLX8). See website/README.md.
 */
const repo = 'https://github.com/daviixs/wifi-mouse';
const blob = `${repo}/blob/main`;
const latest = `${repo}/releases/latest/download`;

export const site = {
  name: 'ConnectMouse',
  title: 'ConnectMouse — Turn Your Phone Into A Wireless Mouse & Keyboard',
  description:
    'ConnectMouse turns your phone into a wireless mouse, touchpad and keyboard for your Mac or Windows PC over local Wi-Fi. Free, open source and private by design.',
  keywords:
    'phone as mouse, wireless mouse app, remote mouse, phone touchpad, phone keyboard for PC, control computer from phone, Wi-Fi mouse, Mac remote, Windows remote',
  repo,
  links: {
    github: repo,
    releases: `${repo}/releases`,
    issues: `${repo}/issues`,
    readme: `${repo}#readme`,
    macGuide: `${blob}/macos/README.md`,
    windowsGuide: `${blob}/windows/README.md`,
    agentGuide: `${blob}/rust-agent/README.md`,
    protocol: `${blob}/src/types/protocol.ts`,
    license: `${blob}/LICENSE`,
    msStore: 'https://apps.microsoft.com/detail/9MZHLB2RMLX8',
    blog: '/blog/',
    privacy: '/privacy/',
  },
  downloads: {
    /** On-page Downloads section (use with `resolveHref` outside the home page). */
    section: '#download',
    /** Windows installer (Inno Setup wizard) from the latest GitHub release. */
    windows: `${latest}/ConnectMouse-Windows-Setup.exe`,
    msStore: 'https://apps.microsoft.com/detail/9MZHLB2RMLX8',
    mac: `${latest}/ConnectMouse-macOS.dmg`,
    /** Android APK for direct install (sideload); no Play Store listing yet. */
    android: `${latest}/ConnectMouse-Android.apk`,
    releases: `${repo}/releases`,
  },
} as const;

export type NavItem = {
  label: string;
  href: string;
  badge?: string;
  children?: { label: string; description: string; href: string; icon: string }[];
};

export const nav: NavItem[] = [
  { label: 'Home', href: '#top' },
  {
    label: 'Features',
    href: '#features',
    children: [
      { label: 'Wireless touchpad', description: 'Move, click and scroll with your fingers.', href: '#features', icon: 'MousePointer2' },
      { label: 'Phone keyboard', description: 'Type on your computer in real time.', href: '#features', icon: 'Keyboard' },
      { label: 'Shortcuts & media', description: 'One-tap shortcuts, playback and volume.', href: '#tools', icon: 'Command' },
    ],
  },
  {
    label: 'Platforms',
    href: '#download',
    children: [
      { label: 'Android app', description: 'Direct APK install for your phone.', href: '#download', icon: 'Smartphone' },
      { label: 'macOS menu bar app', description: 'Lives next to your clock on the Mac.', href: '#download', icon: 'Laptop' },
      { label: 'Windows tray app', description: 'Installer or Microsoft Store.', href: '#download', icon: 'Monitor' },
    ],
  },
  { label: 'Download', href: '#download', badge: 'NEW' },
  { label: 'Blog', href: '/blog/' },
];

/**
 * Landing-page anchors (`#features`) only work on the home page. On other pages
 * (the blog) they must point back to the landing page (`/#features`).
 */
export const resolveHref = (href: string, pathname: string) =>
  href.startsWith('#') && pathname.replace(/\/+$/, '') !== '' ? `/${href}` : href;
