import { WidgetProvider } from './types';
import { BeszelProvider } from './beszel';

export const widgetProviders: Record<string, WidgetProvider> = {
  beszel: new BeszelProvider(),
};
