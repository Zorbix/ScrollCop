import { allSites, parseDomain, siteOrigins } from './sites.js';

const master = document.querySelector('#master-toggle');
const list = document.querySelector('#site-list');
const error = document.querySelector('#error');
let settings;
let pending = false;

let renderedSites = '';
function renderSites() {
  if (!list) return;
  const sites = allSites(settings);
  const key = JSON.stringify(sites);
  if (renderedSites === key) return;
  renderedSites = key;
  list.replaceChildren();
  for (const site of sites) {
    const row = document.createElement('div');
    row.className = 'site-row';
    const icon = document.createElement('span');
    icon.className = 'site-icon';
    icon.style.color = site.color;
    icon.textContent = site.mark;
    icon.setAttribute('aria-hidden', 'true');
    const details = document.createElement('div');
    details.className = 'site-details';
    const name = document.createElement('h3');
    name.textContent = site.name;
    const domain = document.createElement('p');
    domain.textContent = site.domains[0];
    details.append(name, domain);
    const label = document.createElement('label');
    label.className = 'switch small';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.siteId = site.id;
    input.setAttribute('aria-label', `Block ${site.name}`);
    input.disabled = true;
    label.append(input, document.createElement('span'));
    row.append(icon, details, label);
    if (site.custom) {
      const remove = document.createElement('button');
      remove.className = 'remove-site';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', `Remove ${site.name}`);
      remove.addEventListener('click', () => update({ siteId: site.id }, 'removeSite'));
      row.append(remove);
    }
    list.append(row);
    input.addEventListener('change', () => update({ siteId: site.id, blocked: input.checked }));
  }
}

function render() {
  if (!settings) return;
  renderSites();
  master.checked = settings.enabled;
  master.disabled = pending;
  document.querySelector('#master-description').textContent = settings.enabled ? 'ScrollCop is on duty.' : 'ScrollCop is off duty. Resume anytime.';
  const count = Object.values(settings.blocked).filter(Boolean).length;
  const status = document.querySelector('#status-text');
  if (status) status.textContent = settings.enabled ? `${count} ${count === 1 ? 'website' : 'websites'} behind bars.` : 'Blocking paused. All websites are available.';
  document.querySelector('#status-dot')?.classList.toggle('paused', !settings.enabled);
  document.querySelectorAll('[data-site-id]').forEach(input => {
    input.checked = settings.blocked[input.dataset.siteId];
    input.disabled = pending;
  });
  const countLabel = document.querySelector('#site-count');
  if (countLabel) countLabel.textContent = `${count} / ${allSites(settings).length}`;
  document.querySelectorAll('.remove-site, #add-site-form button').forEach(button => { button.disabled = pending; });
  const note = document.querySelector('#pause-note');
  if (note) note.hidden = settings.enabled;
}

async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response || response.error) throw new Error(response?.error || 'The extension did not respond. Try reloading it.');
  return response.settings;
}

async function update(patch, type = 'updateSettings') {
  if (pending) return;
  pending = true;
  render();
  error.textContent = '';
  try { settings = await request({ type, ...patch }); return true; }
  catch (problem) { error.textContent = `Could not save your settings. ${problem.message}`; }
  finally { pending = false; render(); }
}

document.querySelector('#add-site-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  if (pending || !settings) return;
  const field = document.querySelector('#custom-domain');
  const status = document.querySelector('#add-status');
  status.textContent = '';
  error.textContent = '';
  try {
    const domain = parseDomain(field.value);
    if (allSites(settings).some(site => site.domains.some(existing => domain === existing || domain.endsWith(`.${existing}`)))) {
      throw new Error('This website is already on your blocklist. Use its toggle to change blocking.');
    }
    // Request directly from the submit gesture, before any asynchronous work.
    const permission = chrome.permissions.request({ origins: siteOrigins(domain) });
    pending = true;
    render();
    const granted = await permission;
    if (!granted) throw new Error('Website not added. Allow access to this website so ScrollCop can block it.');
    settings = await request({ type: 'addSite', domain });
    field.value = '';
    status.textContent = settings.enabled ? `${domain} added to your blocklist and blocked.` : `${domain} added to your blocklist. Blocking is currently paused.`;
  } catch (problem) { error.textContent = problem.message; }
  finally { pending = false; render(); }
});

master.addEventListener('change', () => update({ enabled: master.checked }));
document.querySelector('#open-options')?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage().catch(problem => { error.textContent = problem.message; });
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings?.newValue) {
    settings = changes.settings.newValue;
    render();
  }
});
try { settings = await request({ type: 'getSettings' }); render(); }
catch (problem) { error.textContent = `Could not load your settings. ${problem.message}`; }
