import { WidgetProvider } from './types';
import { BeszelProvider } from './beszel';
import { QbittorrentProvider } from './qbittorrent';
import { JellyfinProvider } from './jellyfin';

export const widgetProviders: Record<string, WidgetProvider> = {
  beszel: new BeszelProvider(),
  qbittorrent: new QbittorrentProvider(),
  jellyfin: new JellyfinProvider(),
};

