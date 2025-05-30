// Helper: promisify chrome APIs for Firefox/Chrome compatibility
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

let renamingSession = null; // Holds the name of session being renamed (if any)

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

    if (renamingSession === name) {
      // Render rename UI
      div.innerHTML = `
        <input type="text" class="session-rename-input" value="${name}" id="rename-input-${name}" />
        <span>
          <button class="icon-btn" data-action="save-rename" data-name="${name}" title="Save">
            <svg viewBox="0 0 16 16" fill="none"><path d="M4 8l3 3 5-5" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="icon-btn" data-action="cancel-rename" data-name="${name}" title="Cancel">
            <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4L4 12" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </span>
      `;
      setTimeout(() => {
        const input = document.getElementById(`rename-input-${name}`);
        if (input) {
          input.focus();
          input.select();
          input.addEventListener('keydown', async e => {
            if (e.key === 'Enter') {
              await saveRenamedSession(name, input.value.trim());
            } else if (e.key === 'Escape') {
              renamingSession = null;
              refreshUI();
            }
          });
        }
      }, 0);
    } else {
      // Render normal UI
      div.innerHTML = `
        <span class="session-name-display">
          <span title="${name}">${name}</span>
          <button class="icon-btn" data-action="edit" data-name="${name}" title="Rename">
            <svg viewBox="0 0 16 16" fill="none"><path d="M12.3 3.7l-1-1a1 1 0 0 0-1.4 0L4 8.6V12h3.4l5.9-5.9a1 1 0 0 0 0-1.4z" stroke="#222" stroke-width="1.2" fill="#fbbf24"/></svg>
          </button>
        </span>
        <span>
          <button data-action="restore" data-name="${name}">Restore</button>
          <button data-action="delete" data-name="${name}">Delete</button>
        </span>
      `;
    }
    container.appendChild(div);
  });
}

async function saveRenamedSession(oldName, newName) {
  if (!newName) {
    alert('Session name cannot be empty!');
    return;
  }
  if (oldName === newName) {
    renamingSession = null;
    refreshUI();
    return;
  }
  const sessions = await getSessions();
  if (sessions[newName]) {
    alert('A session with this name already exists!');
    return;
  }
  sessions[newName] = sessions[oldName];
  delete sessions[oldName];
  await saveSessions(sessions);
  renamingSession = null;
  refreshUI();
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
  if (sessions[sessionName]) {
    if (!confirm('A session with this name already exists. Overwrite?')) return;
  }
  sessions[sessionName] = selected.map(tab => tab.url);
  await saveSessions(sessions);
  document.getElementById('sessionName').value = '';
  refreshUI();
});

document.getElementById('sessions').addEventListener('click', async e => {
  if (!e.target.closest('button')) return;
  const btn = e.target.closest('button');
  const action = btn.dataset.action;
  const name = btn.dataset.name;
  const sessions = await getSessions();

  if (action === 'restore') {
    const urls = sessions[name];
    for (const url of urls) {
      browserAPI.tabs.create({ url });
    }
  } else if (action === 'delete') {
    if (!confirm('Delete this session?')) return;
    delete sessions[name];
    await saveSessions(sessions);
    refreshUI();
  } else if (action === 'edit') {
    renamingSession = name;
    refreshUI();
  } else if (action === 'save-rename') {
    const input = document.getElementById(`rename-input-${name}`);
    if (input) {
      await saveRenamedSession(name, input.value.trim());
    }
  } else if (action === 'cancel-rename') {
    renamingSession = null;
    refreshUI();
  }
});