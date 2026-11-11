/**
 * Single source of truth for every outbound link on the landing page.
 *
 * Only real, existing URLs are used. The Windows app has a Microsoft Store
 * listing (product 9MZHLB2RMLX8, submitted for certification). The phone and
 * Mac apps have no store listings yet, so their CTAs point at the GitHub
 * Releases page of the public repository. Replace `downloads.*` with the
 * final Play Store / App Store / direct-download URLs when they exist
 * (see website/README.md).
 */
const repo = 'https://github.com/daviixs/wifi-mouse';
const blob = `${repo}/blob/main`;

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
  },
  /** Phone and Mac are PLACEHOLDERS (GitHub Releases) until real store/download URLs exist. */
  downloads: {
    phone: `${repo}/releases`,
    mac: `${repo}/releases`,
    windows: 'https://apps.microsoft.com/detail/9MZHLB2RMLX8',
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
    href: '#pricing',
    children: [
      { label: 'Phone app', description: 'Android and iOS, built with Expo.', href: '#pricing', icon: 'Smartphone' },
      { label: 'macOS menu bar app', description: 'Lives next to your clock on the Mac.', href: '#pricing', icon: 'Laptop' },
      { label: 'Windows tray app', description: 'Native Win32 app in the notification area.', href: '#pricing', icon: 'Monitor' },
    ],
  },
  { label: 'Windows App', href: '#pricing', badge: 'NEW' },
  { label: 'Blog', href: '/blog/' },
];

/**
 * Landing-page anchors (`#features`) only work on the home page. On other pages
 * (the blog) they must point back to the landing page (`/#features`).
 */
export const resolveHref = (href: string, pathname: string) =>
  href.startsWith('#') && pathname.replace(/\/+$/, '') !== '' ? `/${href}` : href;
