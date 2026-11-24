const embedded = window.parent !== window;
const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);

export const environment = loopback && !embedded ? 'mock' : embedded && !loopback ? 'zoho' : 'inactive';
