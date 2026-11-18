export const SITES = [
  { id: 1, name: 'Instagram', domains: ['instagram.com'], color: '#b9457e', mark: 'ig' },
  { id: 2, name: 'Facebook', domains: ['facebook.com', 'fb.com'], color: '#1877f2', mark: 'f' },
  { id: 3, name: 'X / Twitter', domains: ['x.com', 'twitter.com'], color: '#242424', mark: '𝕏' },
  { id: 4, name: 'TikTok', domains: ['tiktok.com'], color: '#25252d', mark: '♪' },
  { id: 5, name: 'YouTube', domains: ['youtube.com', 'youtu.be'], color: '#e74343', mark: '▶' },
  { id: 6, name: 'Reddit', domains: ['reddit.com', 'redd.it'], color: '#e65c2b', mark: 'r' },
  { id: 7, name: 'Threads', domains: ['threads.net', 'threads.com'], color: '#343434', mark: '@' },
  { id: 8, name: 'Snapchat', domains: ['snapchat.com'], color: '#8c7800', mark: 's' },
  { id: 9, name: 'LinkedIn', domains: ['linkedin.com'], color: '#0a66c2', mark: 'in' },
  { id: 10, name: 'Pinterest', domains: ['pinterest.com'], color: '#bd3042', mark: 'p' },
  { id: 11, name: 'Twitch', domains: ['twitch.tv'], color: '#8251ca', mark: 'tw' },
  { id: 12, name: 'Discord', domains: ['discord.com', 'discord.gg'], color: '#5865f2', mark: 'd' },
  { id: 13, name: 'Bluesky', domains: ['bsky.app'], color: '#2585d6', mark: 'b' },
  { id: 14, name: 'Tumblr', domains: ['tumblr.com'], color: '#35465c', mark: 't' },
  { id: 15, name: '9GAG', domains: ['9gag.com'], color: '#242424', mark: '9' }
];

export function parseDomain(input) {
  const text = String(input || '').trim();
  let url;
  try { url = new URL(text.includes('://') ? text : `https://${text}`); }
  catch { throw new Error('Enter a valid website, such as example.com.'); }
  const domain = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || domain.length > 253 ||
      !domain.includes('.') || !domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || /^\d+(\.\d+){3}$/.test(domain)) {
    throw new Error('Enter a public website domain, such as example.com.');
  }
  return domain;
}

export function siteOrigins(domain) {
  return [`http://*.${domain}/*`, `https://*.${domain}/*`];
}

export function allSites(settings) {
  return [...SITES, ...settings.customSites];
}

export function normalizeSettings(value = {}) {
  const customSites = [];
  for (const site of Array.isArray(value.customSites) ? value.customSites : []) {
    try {
      const domain = parseDomain(site.domains?.[0]);
      if (!Number.isInteger(site.id) || site.id < 1000 || site.id > 2147483647 || customSites.some(item => item.id === site.id || item.domains[0] === domain)) continue;
      customSites.push({ id: site.id, name: domain, domains: [domain], color: '#39735d', mark: '↗', custom: true });
    } catch { /* Ignore malformed stored entries. */ }
  }
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    customSites,
    blocked: Object.fromEntries([...SITES, ...customSites].map(site => [site.id, typeof value.blocked?.[site.id] === 'boolean' ? value.blocked[site.id] : true]))
  };
}

export function buildRules(settings) {
  return settings.enabled ? allSites(settings).filter(site => settings.blocked[site.id]).map(site => ({
    id: site.id,
    priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
    condition: { requestDomains: site.domains, resourceTypes: ['main_frame'] }
  })) : [];
}

export function blockedSiteForUrl(settings, address) {
  if (!settings.enabled) return;
  let url;
  try { url = new URL(address); } catch { return; }
  if (!['http:', 'https:'].includes(url.protocol)) return;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  return allSites(settings).find(site => settings.blocked[site.id] && site.domains.some(domain =>
    hostname === domain || hostname.endsWith(`.${domain}`)
  ));
}
