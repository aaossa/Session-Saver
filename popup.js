// Helper: promisify chrome APIs for Firefox/Chrome compatibility
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

async function getTabs() {
  return browserAPI.tabs.query({ currentWindow: true });
}

async function getSessions() {
  return new Promise(resolve =>
    browserAPI.storage.local.get('sessions', r => resolve(r.sessions || {}))
  );
}

async function saveSessions(sessions) {
  return new Promise(resolve =>
    browserAPI.storage.local.set({ sessions }, resolve)
  );
}

function renderTabs(tabs) {
  const container = document.getElementById('tabs');
  container.innerHTML = '';

  // Select/Unselect all checkbox row
  const selectAllRow = document.createElement('div');
  selectAllRow.className = 'select-all-row';
  selectAllRow.innerHTML = `
    <input type="checkbox" id="selectAllTabs" checked style="margin-right:8px;" />
    <label for="selectAllTabs" class="select-all-label">Select/Unselect All</label>
  `;
  container.appendChild(selectAllRow);

  // Individual tab checkboxes
  tabs.forEach(tab => {
    const div = document.createElement('div');
    div.className = 'tab-row';
    div.innerHTML = `
      <input type="checkbox" class="tab-checkbox" id="tab-${tab.id}" checked />
      <label for="tab-${tab.id}" title="${tab.url}">
        ${tab.title}
      </label>
    `;
    container.appendChild(div);
  });

  // Handler for "Select/Unselect All"
  const selectAllBox = document.getElementById('selectAllTabs');
  selectAllBox.addEventListener('change', () => {
    const allChecked = selectAllBox.checked;
    tabs.forEach(tab => {
      document.getElementById(`tab-${tab.id}`).checked = allChecked;
    });
  });

  // Handler for individual checkboxes to update "Select/Unselect All"
  tabs.forEach(tab => {
    const checkbox = document.getElementById(`tab-${tab.id}`);
    checkbox.addEventListener('change', () => {
      const allChecked = tabs.every(tab2 => document.getElementById(`tab-${tab2.id}`).checked);
      selectAllBox.checked = allChecked;
      // If at least one is unchecked, but not all, make selectAllBox indeterminate
      if (!allChecked && tabs.some(tab2 => document.getElementById(`tab-${tab2.id}`).checked)) {
        selectAllBox.indeterminate = true;
      } else {
        selectAllBox.indeterminate = false;
      }
    });
  });
}

function renderSessions(sessions) {
  const container = document.getElementById('sessions');
  container.innerHTML = '';
  Object.keys(sessions).forEach(name => {
    const div = document.createElement('div');
    div.className = 'session';
    div.innerHTML = `
      <span>${name}</span>
      <span>
        <button data-action="restore" data-name="${name}">Restore</button>
        <button data-action="delete" data-name="${name}">Delete</button>
      </span>
    `;
    container.appendChild(div);
  });
}

async function refreshUI() {
  const [tabs, sessions] = await Promise.all([getTabs(), getSessions()]);
  renderTabs(tabs);
  renderSessions(sessions);
}

document.addEventListener('DOMContentLoaded', refreshUI);

document.getElementById('saveBtn').addEventListener('click', async () => {
  const sessionName = document.getElementById('sessionName').value.trim();
  if (!sessionName) return alert('Enter a session name!');
  const tabs = await getTabs();
  const selected = tabs.filter(tab => document.getElementById(`tab-${tab.id}`).checked);
  if (selected.length === 0) return alert('No tabs selected!');
  const sessions = await getSessions();
  sessions[sessionName] = selected.map(tab => tab.url);
  await saveSessions(sessions);
  document.getElementById('sessionName').value = '';
  refreshUI();
});

document.getElementById('sessions').addEventListener('click', async e => {
  if (!e.target.dataset.action) return;
  const sessions = await getSessions();
  const name = e.target.dataset.name;
  if (e.target.dataset.action === 'restore') {
    const urls = sessions[name];
    for (const url of urls) {
      browserAPI.tabs.create({ url });
    }
  } else if (e.target.dataset.action === 'delete') {
    delete sessions[name];
    await saveSessions(sessions);
    refreshUI();
  }
});