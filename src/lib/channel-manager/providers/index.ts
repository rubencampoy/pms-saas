import { ProviderName } from '@/lib/constants/channel-manager';
import type { ChannelManagerProvider } from '@/lib/channel-manager/types';
import { zodomusProvider } from './zodomus';

const PROVIDERS: Record<string, ChannelManagerProvider> = {
  [ProviderName.ZODOMUS]: zodomusProvider,
};

export function getProvider(name: string): ChannelManagerProvider {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`Unknown channel manager provider: ${name}`);
  }
  return provider;
}
