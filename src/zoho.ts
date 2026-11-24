const sdkUrl = 'https://live.zwidgets.com/js-sdk/1.4/ZohoEmbededAppSDK.min.js';

declare global {
  interface Window {
    ZOHO?: { embeddedApp: { init(): void | Promise<unknown> } };
  }
}

export async function initializeZoho(): Promise<void> {
  const script = document.createElement('script');
  let timeout: number | undefined;
  const initialize = new Promise<void>((resolve, reject) => {
    script.src = sdkUrl;
    script.addEventListener('error', () => reject(new Error('CRM SDK unavailable')), { once: true });
    script.addEventListener('load', async () => {
      try {
        if (!window.ZOHO?.embeddedApp) throw new Error('CRM SDK initialization unavailable');
        await window.ZOHO.embeddedApp.init();
        resolve();
      } catch (error) {
        reject(error);
      }
    }, { once: true });
    document.head.append(script);
  });
  try {
    await Promise.race([
      initialize,
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error('CRM initialization timed out')), 8000);
      }),
    ]);
  } finally {
    window.clearTimeout(timeout);
    script.remove();
  }
}
