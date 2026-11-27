import type { GetLeads } from './data/zoho.js';

const sdkUrl = 'https://live.zwidgets.com/js-sdk/1.5/ZohoEmbededAppSDK.min.js';

interface ZohoSDK {
  embeddedApp: { init(): void | Promise<unknown> };
  CRM: {
    UI?: { Record?: { open(data: { Entity: 'Leads'; RecordID: string }): Promise<boolean> } };
  };
}

interface ZohoWidget {
  sdk: ZohoSDK;
  zrc: { get: GetLeads };
}

declare global {
  interface Window {
    ZOHO?: ZohoSDK;
    zrc?: ZohoWidget['zrc'];
  }
}

let sdkReady: Promise<ZohoWidget> | undefined;

export function initializeZoho(): Promise<ZohoWidget> {
  sdkReady ??= loadSDK().catch(error => {
    sdkReady = undefined;
    throw error;
  });
  return sdkReady;
}

async function loadSDK(): Promise<ZohoWidget> {
  const script = document.createElement('script');
  let timeout: number | undefined;
  const initialize = new Promise<ZohoWidget>((resolve, reject) => {
    script.src = sdkUrl;
    script.addEventListener('error', () => reject(new Error('The Zoho CRM SDK could not load.')), { once: true });
    script.addEventListener('load', async () => {
      const sdk = window.ZOHO;
      const zrc = window.zrc;
      if (typeof sdk?.embeddedApp?.init !== 'function' || typeof zrc?.get !== 'function') {
        reject(new Error('Zoho CRM widget SDK 1.5 did not expose the embedded app or ZRC GET method.'));
        return;
      }
      try {
        await sdk.embeddedApp.init();
        resolve({ sdk, zrc });
      } catch {
        reject(new Error('Zoho CRM could not initialize the Homepage widget.'));
      }
    }, { once: true });
    document.head.append(script);
  });
  try {
    return await Promise.race([
      initialize,
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error('Zoho CRM initialization timed out.')), 10000);
      }),
    ]);
  } finally {
    window.clearTimeout(timeout);
    script.remove();
  }
}
