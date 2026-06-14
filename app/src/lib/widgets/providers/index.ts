import { WidgetProvider } from './types';
import { BeszelProvider } from './beszel';
import { QbittorrentProvider } from './qbittorrent';
import { JellyfinProvider } from './jellyfin';
import { UmamiProvider } from './umami';
import { WgEasyProvider } from './wg-easy';
import { UptimeKumaProvider } from './uptime-kuma';

export const widgetProviders: Record<string, WidgetProvider> = {
  beszel: new BeszelProvider(),
  qbittorrent: new QbittorrentProvider(),
  jellyfin: new JellyfinProvider(),
  umami: new UmamiProvider(),
  'wg-easy': new WgEasyProvider(),
  'uptime-kuma': new UptimeKumaProvider(),
};


