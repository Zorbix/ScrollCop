import { normalizeSettings, buildRules, allSites, parseDomain, siteOrigins, blockedSiteForUrl } from './sites.js';

async function synchronize(settings) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map(rule => rule.id),
    addRules: buildRules(settings)
  });
  await chrome.action.setBadgeText({ text: settings.enabled ? 'ON' : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#39735d' });
}

// Serialize changes from different windows so the newest settings always win.
let queue = Promise.resolve();
function enqueue(work) {
  const result = queue.then(work);
  queue = result.catch(error => console.error('ScrollCop:', error));
  return result;
}

async function initialize() {
  const { settings } = await chrome.storage.local.get('settings');
  const normalized = normalizeSettings(settings);
  await synchronize(normalized);
  await chrome.storage.local.set({ settings: normalized });
}

chrome.runtime.onInstalled.addListener(() => { enqueue(initialize); });
chrome.runtime.onStartup.addListener(() => { enqueue(initialize); });

// Cached service-worker responses and in-page navigation can bypass network rules.
async function checkNavigation(details) {
  if (details.frameId !== 0 || details.tabId < 0) return;
  await enqueue(async () => {
    const { settings: stored } = await chrome.storage.local.get('settings');
    const settings = normalizeSettings(stored);
    if (!blockedSiteForUrl(settings, details.url)) return;
    if (!await chrome.permissions.contains({ origins: [new URL(details.url).origin + '/*'] })) return;
    // Ignore a delayed event if the user has already navigated elsewhere.
    const tab = await chrome.tabs.get(details.tabId);
    const currentUrl = tab.pendingUrl || tab.url;
    if (!currentUrl || !blockedSiteForUrl(settings, currentUrl)) return;
    await chrome.tabs.update(details.tabId, { url: chrome.runtime.getURL('blocked.html') });
  });
}

const navigationFilter = { url: [{ schemes: ['http', 'https'] }] };
const onNavigation = details => { checkNavigation(details).catch(error => console.debug('ScrollCop navigation:', error)); };
chrome.webNavigation.onCommitted.addListener(onNavigation, navigationFilter);
chrome.webNavigation.onHistoryStateUpdated.addListener(onNavigation, navigationFilter);
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !['getSettings', 'updateSettings', 'addSite', 'removeSite'].includes(message.type)) return;
  enqueue(async () => {
    const { settings: stored } = await chrome.storage.local.get('settings');
    const settings = normalizeSettings(stored);
    if (message.type === 'addSite') {
      const domain = parseDomain(message.domain);
      if (allSites(settings).some(site => site.domains.some(existing => domain === existing || domain.endsWith(`.${existing}`)))) {
        throw new Error('This website is already on your blocklist. Use its toggle to change blocking.');
      }
      if (settings.customSites.length >= 500) throw new Error('You can add up to 500 custom websites.');
      if (!await chrome.permissions.contains({ origins: siteOrigins(domain) })) {
        throw new Error('Site permission is required to show the ScrollCop blocked page.');
      }
      const id = Math.max(999, ...settings.customSites.map(site => site.id)) + 1;
      settings.customSites.push({ id, name: domain, domains: [domain], color: '#39735d', mark: '↗', custom: true });
      settings.blocked[id] = true;
    }
    if (message.type === 'removeSite') {
      settings.customSites = settings.customSites.filter(site => site.id !== message.siteId);
      if (message.siteId >= 1000) delete settings.blocked[message.siteId];
    }
    if (message.type === 'updateSettings') {
      if (typeof message.enabled === 'boolean') settings.enabled = message.enabled;
      if (Object.hasOwn(settings.blocked, message.siteId) && typeof message.blocked === 'boolean') {
        settings.blocked[message.siteId] = message.blocked;
      }
    }
    await synchronize(settings);
    await chrome.storage.local.set({ settings });
    return settings;
  }).then(settings => respond({ settings }), error => respond({ error: error.message }));
  return true;
});
