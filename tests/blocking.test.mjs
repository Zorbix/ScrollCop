import test from 'node:test';
import assert from 'node:assert/strict';
import { SITES, normalizeSettings, buildRules, parseDomain, siteOrigins, blockedSiteForUrl } from '../sites.js';
import { readFile } from 'node:fs/promises';

test('custom site permissions use the explicit schemes declared in the manifest', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
  const origins = siteOrigins('idnes.cz');
  assert.deepEqual(origins, ['http://*.idnes.cz/*', 'https://*.idnes.cz/*']);
  for (const origin of origins) {
    const scheme = origin.split('://')[0];
    assert.ok(manifest.optional_host_permissions.includes(`${scheme}://*/*`));
  }
});

test('custom domains normalize URLs and reject invalid input', () => {
  assert.equal(parseDomain(' https://www.Example.com/path?q=1 '), 'example.com');
  assert.equal(parseDomain('news.example.com'), 'news.example.com');
  for (const input of ['', 'localhost', '*.example.com', 'https://user:pass@example.com', 'ftp://example.com', '127.0.0.1', 'example.com:8080', '-bad.com']) {
    assert.throws(() => parseDomain(input));
  }
});

test('navigation fallback matches X, Twitter, and subdomains without matching lookalikes', () => {
  const settings = normalizeSettings();
  for (const url of ['https://x.com/', 'https://x.com/home', 'https://mobile.twitter.com/home']) {
    assert.equal(blockedSiteForUrl(settings, url)?.id, 3);
  }
  for (const url of ['https://notx.com/', 'https://x.com.example.org/', 'chrome://extensions', 'invalid']) {
    assert.equal(blockedSiteForUrl(settings, url), undefined);
  }
  settings.blocked[3] = false;
  assert.equal(blockedSiteForUrl(settings, 'https://x.com/home'), undefined);
  settings.blocked[3] = true;
  settings.enabled = false;
  assert.equal(blockedSiteForUrl(settings, 'https://x.com/home'), undefined);
});

test('custom websites persist and obey their individual and master switches', () => {
  const settings = normalizeSettings({ customSites: [{ id: 1000, domains: ['example.com'] }] });
  assert.equal(settings.customSites[0].name, 'example.com');
  assert.deepEqual(buildRules(settings).find(rule => rule.id === 1000).condition.requestDomains, ['example.com']);
  settings.blocked[1000] = false;
  assert.ok(!buildRules(settings).some(rule => rule.id === 1000));
  assert.equal(normalizeSettings(settings).blocked[1000], false);
  settings.enabled = false;
  assert.deepEqual(buildRules(settings), []);
});

test('first installation blocks every default network', () => {
  const rules = buildRules(normalizeSettings());
  assert.equal(rules.length, SITES.length);
  assert.equal(new Set(rules.map(rule => rule.id)).size, rules.length);
  for (const rule of rules) {
    assert.equal(rule.action.type, 'redirect');
    assert.equal(rule.action.redirect.extensionPath, '/blocked.html');
    assert.deepEqual(rule.condition.resourceTypes, ['main_frame']);
    assert.ok(rule.condition.requestDomains.length > 0);
  }
});

test('master pause removes all rules and preserves individual choices', () => {
  const settings = normalizeSettings({ enabled: false, blocked: { 1: false } });
  assert.deepEqual(buildRules(settings), []);
  settings.enabled = true;
  assert.equal(buildRules(settings).length, SITES.length - 1);
  assert.ok(!buildRules(settings).some(rule => rule.id === 1));
});

test('normalization preserves saved choices and enables newly added networks', () => {
  const settings = normalizeSettings({ enabled: false, blocked: { 1: false, 2: true } });
  assert.equal(settings.enabled, false);
  assert.equal(settings.blocked[1], false);
  assert.equal(settings.blocked[2], true);
  assert.equal(settings.blocked[14], true);
});

test('worker serializes independent setting updates without losing changes', async () => {
  let listener;
  let stored;
  let rules = [];
  let permissionGranted = true;
  let navigationListener;
  let currentUrl = 'https://x.com/home';
  const redirects = [];
  globalThis.chrome = {
    webNavigation: {
      onCommitted: { addListener(fn) { navigationListener = fn; } },
      onHistoryStateUpdated: { addListener() {} }
    },
    tabs: {
      async get() { return { url: currentUrl }; },
      async update(id, change) { redirects.push(change.url); }
    },
    permissions: { async contains() { return permissionGranted; } },
    runtime: {
      id: 'test-extension',
      getURL(path) { return `chrome-extension://test-extension/${path}`; },
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      onMessage: { addListener(fn) { listener = fn; } }
    },
    storage: { local: {
      async get() { return { settings: structuredClone(stored) }; },
      async set(value) { stored = structuredClone(value.settings); }
    } },
    declarativeNetRequest: {
      async getDynamicRules() { return structuredClone(rules); },
      async updateDynamicRules(update) { rules = structuredClone(update.addRules); }
    },
    action: { async setBadgeText() {}, async setBadgeBackgroundColor() {} }
  };
  await import('../background.js');
  const send = message => new Promise(resolve => listener(message, { id: 'test-extension' }, resolve));
  await Promise.all([
    send({ type: 'updateSettings', siteId: 1, blocked: false }),
    send({ type: 'updateSettings', siteId: 2, blocked: false })
  ]);
  assert.equal(stored.blocked[1], false);
  assert.equal(stored.blocked[2], false);
  assert.equal(rules.length, SITES.length - 2);
  await send({ type: 'updateSettings', enabled: false });
  assert.deepEqual(rules, []);
  await send({ type: 'updateSettings', enabled: true });
  assert.equal(rules.length, SITES.length - 2);
  const added = await send({ type: 'addSite', domain: 'https://www.example.com/path' });
  assert.equal(added.settings.customSites[0].domains[0], 'example.com');
  const customId = added.settings.customSites[0].id;
  assert.ok(rules.some(rule => rule.id === customId));
  assert.match((await send({ type: 'addSite', domain: 'example.com' })).error, /already/);
  assert.match((await send({ type: 'addSite', domain: 'www.instagram.com' })).error, /already/);
  permissionGranted = false;
  assert.match((await send({ type: 'addSite', domain: 'another.com' })).error, /permission/);
  permissionGranted = true;
  await send({ type: 'updateSettings', siteId: customId, blocked: false });
  assert.ok(!rules.some(rule => rule.id === customId));
  await send({ type: 'removeSite', siteId: customId });
  assert.deepEqual(stored.customSites, []);
  assert.ok(!Object.hasOwn(stored.blocked, customId));
  navigationListener({ frameId: 0, tabId: 1, url: currentUrl });
  await send({ type: 'getSettings' });
  assert.deepEqual(redirects, ['chrome-extension://test-extension/blocked.html']);
  currentUrl = 'https://example.org/';
  navigationListener({ frameId: 0, tabId: 1, url: 'https://x.com/home' });
  await send({ type: 'getSettings' });
  assert.equal(redirects.length, 1);
  currentUrl = 'https://x.com/home';
  await send({ type: 'updateSettings', siteId: 3, blocked: false });
  navigationListener({ frameId: 0, tabId: 1, url: currentUrl });
  await send({ type: 'getSettings' });
  assert.equal(redirects.length, 1);
});
