const browserAPI = typeof browser !== "undefined" ? browser : chrome;

function showMsg(text, type) {
  const el = document.getElementById('msg');
  el.textContent = text;
  el.className = "msg " + (type || "");
}

// Helper to disable/enable the import button with style change
function setImportBtnDisabled(disabled) {
  const importBtn = document.getElementById('importBtn');
  if (disabled) {
    importBtn.disabled = true;
    importBtn.style.background = "#a1a1aa";
    importBtn.style.cursor = "not-allowed";
    importBtn.style.opacity = "0.7";
  } else {
    importBtn.disabled = false;
    importBtn.style.background = "#2563eb";
    importBtn.style.cursor = "pointer";
    importBtn.style.opacity = "1";
  }
}

// Helper to download a JSON file
function downloadJSON(data, filename = "sessions-backup.json") {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderSessionExportList(sessions) {
  const listDiv = document.getElementById('exportSessionList');
  listDiv.innerHTML = '';
  const entries = Object.entries(sessions);
  if (entries.length === 0) {
    listDiv.innerHTML = '<em>No sessions to export.</em>';
    document.getElementById('exportSelectedBtn').disabled = true;
    return;
  }
  entries.forEach(([name]) => {
    const div = document.createElement('div');
    div.style.marginBottom = '3px';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'export-session-checkbox';
    checkbox.id = 'export-session-' + name;
    checkbox.value = name;
    checkbox.checked = true;
    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = name;
    div.appendChild(checkbox);
    div.appendChild(label);
    listDiv.appendChild(div);
  });
  document.getElementById('exportSelectedBtn').disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
  browserAPI.storage.local.get('sessions', data => {
    renderSessionExportList(data.sessions || {});
  });
});

document.getElementById('exportAllBtn').addEventListener('click', () => {
  browserAPI.storage.local.get('sessions', data => {
    const sessions = data.sessions || {};
    if (Object.keys(sessions).length === 0) {
      showMsg("No sessions to export.", "error");
      return;
    }
    downloadJSON(sessions, "sessions-backup.json");
    showMsg("Exported all sessions!", "success");
  });
});

document.getElementById('exportSelectedBtn').addEventListener('click', () => {
  browserAPI.storage.local.get('sessions', data => {
    const sessions = data.sessions || {};
    const checkboxes = document.querySelectorAll('.export-session-checkbox');
    const selectedNames = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);
    if (selectedNames.length === 0) {
      showMsg("Select at least one session to export.", "error");
      return;
    }
    const selectedSessions = {};
    for (const name of selectedNames) {
      selectedSessions[name] = sessions[name];
    }
    const fileName = selectedNames.length === 1
      ? `session-${selectedNames[0].replace(/[^a-z0-9_\-]+/gi, "_")}.json`
      : "sessions-selected-backup.json";
    downloadJSON(selectedSessions, fileName);
    showMsg(`Exported ${selectedNames.length} session${selectedNames.length > 1 ? "s" : ""}!`, "success");
  });
});

document.getElementById('importBtn').addEventListener('click', () => {
  const importBtn = document.getElementById('importBtn');
  setImportBtnDisabled(true);

  setTimeout(() => {
    setImportBtnDisabled(false);
  }, 1500);

  const fileInput = document.getElementById('importFile');
  const file = fileInput.files[0];
  if (!file) {
    showMsg("Please select a JSON file to import.", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const importedSessions = JSON.parse(e.target.result);
      if (typeof importedSessions !== "object" || Array.isArray(importedSessions))
        throw new Error("Invalid format");
      if (!Object.values(importedSessions).every(urls => Array.isArray(urls)))
        throw new Error("Invalid format");

      browserAPI.storage.local.get('sessions', oldData => {
        let currentSessions = oldData.sessions || {};
        let addedCount = 0;
        for (const [name, urls] of Object.entries(importedSessions)) {
          let newName = `${name} (${file.name})`;
          // If newName already exists, make it unique
          let uniqueName = newName;
          let counter = 2;
          while (uniqueName in currentSessions) {
            uniqueName = `${newName} [${counter}]`;
            counter += 1;
          }
          currentSessions[uniqueName] = urls;
          addedCount++;
        }
        browserAPI.storage.local.set({ sessions: currentSessions }, () => {
          showMsg(`Imported ${addedCount} session${addedCount !== 1 ? 's' : ''} from "${file.name}".`, "success");
          // Rerender export session list after import
          renderSessionExportList(currentSessions);
        });
      });
    } catch (err) {
      showMsg("Invalid session backup file.", "error");
    }
  };
  reader.readAsText(file);
});