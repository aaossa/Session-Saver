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
  container.textContent = '';

  // Select/Unselect all checkbox row
  const selectAllRow = document.createElement('div');
  selectAllRow.className = 'select-all-row';
  const selectAllBox = document.createElement('input');
  selectAllBox.type = 'checkbox';
  selectAllBox.id = 'selectAllTabs';
  selectAllBox.checked = true;
  selectAllBox.style.marginRight = "8px";
  const selectAllLabel = document.createElement('label');
  selectAllLabel.htmlFor = 'selectAllTabs';
  selectAllLabel.className = 'select-all-label';
  selectAllLabel.textContent = "Select/Unselect All";
  selectAllRow.appendChild(selectAllBox);
  selectAllRow.appendChild(selectAllLabel);
  container.appendChild(selectAllRow);

  // Individual tab checkboxes
  tabs.forEach(tab => {
    const div = document.createElement('div');
    div.className = 'tab-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'tab-checkbox';
    checkbox.id = `tab-${tab.id}`;
    checkbox.checked = true;

    const label = document.createElement('label');
    label.htmlFor = `tab-${tab.id}`;
    label.title = tab.url;
    label.textContent = tab.title;

    div.appendChild(checkbox);
    div.appendChild(label);
    container.appendChild(div);
  });

  // Handler for "Select/Unselect All"
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
      if (!allChecked && tabs.some(tab2 => document.getElementById(`tab-${tab2.id}`).checked)) {
        selectAllBox.indeterminate = true;
      } else {
        selectAllBox.indeterminate = false;
      }
    });
  });
}

function createSVGIcon(type) {
  // Returns a SVG element for edit, save, cancel icons
  const ns = "http://www.w3.org/2000/svg";
  let svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  svg.style.width = "1em";
  svg.style.height = "1em";
  let path = document.createElementNS(ns, "path");
  if (type === "edit") {
    path.setAttribute("d", "M12.3 3.7l-1-1a1 1 0 0 0-1.4 0L4 8.6V12h3.4l5.9-5.9a1 1 0 0 0 0-1.4z");
    path.setAttribute("stroke", "#222");
    path.setAttribute("stroke-width", "1.2");
    path.setAttribute("fill", "#fbbf24");
  } else if (type === "save") {
    path.setAttribute("d", "M4 8l3 3 5-5");
    path.setAttribute("stroke", "#fff");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
  } else if (type === "cancel") {
    path.setAttribute("d", "M4 4l8 8M12 4L4 12");
    path.setAttribute("stroke", "#fff");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
  }
  svg.appendChild(path);
  return svg;
}

function renderSessions(sessions) {
  const container = document.getElementById('sessions');
  container.textContent = '';
  Object.keys(sessions).forEach(name => {
    const div = document.createElement('div');
    div.className = 'session';

    if (renamingSession === name) {
      // Rename UI
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'session-rename-input';
      input.value = name;
      input.id = `rename-input-${name}`;

      const btnSpan = document.createElement('span');

      const saveBtn = document.createElement('button');
      saveBtn.className = 'icon-btn';
      saveBtn.dataset.action = "save-rename";
      saveBtn.dataset.name = name;
      saveBtn.title = "Save";
      saveBtn.appendChild(createSVGIcon("save"));

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'icon-btn';
      cancelBtn.dataset.action = "cancel-rename";
      cancelBtn.dataset.name = name;
      cancelBtn.title = "Cancel";
      cancelBtn.appendChild(createSVGIcon("cancel"));

      btnSpan.appendChild(saveBtn);
      btnSpan.appendChild(cancelBtn);

      div.appendChild(input);
      div.appendChild(btnSpan);

      setTimeout(() => {
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
      }, 0);
    } else {
      // Normal UI
      const nameSpan = document.createElement('span');
      nameSpan.className = 'session-name-display';

      const nameText = document.createElement('span');
      nameText.textContent = name;
      nameText.title = name;

      const editBtn = document.createElement('button');
      editBtn.className = 'icon-btn';
      editBtn.dataset.action = "edit";
      editBtn.dataset.name = name;
      editBtn.title = "Rename";
      editBtn.appendChild(createSVGIcon("edit"));

      nameSpan.appendChild(nameText);
      nameSpan.appendChild(editBtn);

      const btnSpan = document.createElement('span');

      const restoreBtn = document.createElement('button');
      restoreBtn.dataset.action = "restore";
      restoreBtn.dataset.name = name;
      restoreBtn.textContent = "Restore";

      const deleteBtn = document.createElement('button');
      deleteBtn.dataset.action = "delete";
      deleteBtn.dataset.name = name;
      deleteBtn.textContent = "Delete";

      btnSpan.appendChild(restoreBtn);
      btnSpan.appendChild(deleteBtn);

      div.appendChild(nameSpan);
      div.appendChild(btnSpan);
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

document.getElementById('openOptions').addEventListener('click', e => {
  e.preventDefault();
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL('options.html'));
  }
});
