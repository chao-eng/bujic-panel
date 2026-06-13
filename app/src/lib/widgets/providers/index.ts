import { WidgetProvider } from './types';
import { BeszelProvider } from './beszel';
import { QbittorrentProvider } from './qbittorrent';

export const widgetProviders: Record<string, WidgetProvider> = {
  beszel: new BeszelProvider(),
  qbittorrent: new QbittorrentProvider(),
};
