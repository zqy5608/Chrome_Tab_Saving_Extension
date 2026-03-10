const saveCurrentTabButton = document.querySelector("#save-current-tab-button");
const saveAllTabsButton = document.querySelector("#save-all-tabs-button");
const exportButton = document.querySelector("#export-button");
const importButton = document.querySelector("#import-button");
const importFileInput = document.querySelector("#import-file");
const collectionCount = document.querySelector("#collection-count");
const emptyState = document.querySelector("#empty-state");
const collectionList = document.querySelector("#collection-list");
const statusMessage = document.querySelector("#status-message");
const template = document.querySelector("#collection-item-template");

let editingCollectionId = null;

applyStaticTranslations();
initialize().catch(showError);

saveCurrentTabButton.addEventListener("click", async () => {
  try {
    await withButtonBusy(saveCurrentTabButton, t("saving"), async () => {
      const collections = await sendMessage("SAVE_CURRENT_TAB");
      renderCollections(collections);
      showStatus(t("statusSavedCurrentTab"));
    });
  } catch (error) {
    showError(error);
  }
});

saveAllTabsButton.addEventListener("click", async () => {
  try {
    await withButtonBusy(saveAllTabsButton, t("saving"), async () => {
      const collections = await sendMessage("SAVE_ALL_TABS");
      renderCollections(collections);
      showStatus(t("statusSavedAllTabs"));
    });
  } catch (error) {
    showError(error);
  }
});

exportButton.addEventListener("click", async () => {
  try {
    await withButtonBusy(exportButton, t("exporting"), async () => {
      const payload = await sendMessage("EXPORT_DATA");
      downloadJson(payload);
      showStatus(t("statusExported"));
    });
  } catch (error) {
    showError(error);
  }
});

importButton.addEventListener("click", () => {
  importFileInput.click();
});

importFileInput.addEventListener("change", async () => {
  const [file] = importFileInput.files;
  if (!file) {
    return;
  }

  try {
    const content = await file.text();
    const payload = JSON.parse(content);
    const collections = await sendMessage("IMPORT_DATA", payload);
    renderCollections(collections);
    showStatus(t("statusImported"));
  } catch (error) {
    showError(error);
  } finally {
    importFileInput.value = "";
  }
});

collectionList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const role = target.dataset.role;
  const collectionId =
    target.dataset.collectionId || target.closest(".collection-item")?.querySelector(".editor")?.dataset.collectionId;

  try {
    switch (role) {
      case "open":
        if (!collectionId) {
          return;
        }
        await withButtonBusy(target, t("opening"), async () => {
          await sendMessage("OPEN_COLLECTION", { collectionId });
          showStatus(t("statusOpenedFavorite"));
        });
        break;
      case "toggle-edit":
        if (!collectionId) {
          return;
        }
        editingCollectionId = editingCollectionId === collectionId ? null : collectionId;
        renderCollections(await sendMessage("GET_COLLECTIONS"));
        break;
      case "cancel-edit":
        editingCollectionId = null;
        renderCollections(await sendMessage("GET_COLLECTIONS"));
        break;
      case "add-tab":
        addEditorTabRow(target.closest(".editor-tabs"));
        break;
      case "remove-tab":
        target.closest(".editor-tab")?.remove();
        break;
      case "pin":
        if (!collectionId) {
          return;
        }
        renderCollections(await sendMessage("TOGGLE_COLLECTION_PINNED", { collectionId }));
        showStatus(t("statusPinUpdated"));
        break;
      case "delete":
        if (!collectionId) {
          return;
        }
        renderCollections(await sendMessage("DELETE_COLLECTION", { collectionId }));
        showStatus(t("statusDeletedFavorite"));
        break;
      default:
        break;
    }
  } catch (error) {
    showError(error);
  }
});

collectionList.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  event.preventDefault();

  const collectionId = form.dataset.collectionId;
  if (!collectionId) {
    return;
  }

  const nameInput = form.querySelector(".collection-edit-name");
  const rows = [...form.querySelectorAll(".editor-tab")];
  const tabs = rows.map((row) => ({
    title: row.querySelector("[data-field='title']")?.value?.trim() || "",
    url: row.querySelector("[data-field='url']")?.value?.trim() || ""
  }));

  try {
    const collections = await sendMessage("UPDATE_COLLECTION", {
      collectionId,
      updates: {
        name: nameInput?.value,
        tabs
      }
    });

    editingCollectionId = null;
    renderCollections(collections);
    showStatus(t("statusSavedChanges"));
  } catch (error) {
    showError(error);
  }
});

async function initialize() {
  const collections = await sendMessage("GET_COLLECTIONS");
  renderCollections(collections);
}

function renderCollections(collections) {
  collectionList.textContent = "";
  collectionCount.textContent = String(collections.length);
  emptyState.hidden = collections.length > 0;

  for (const collection of collections) {
    const fragment = template.content.cloneNode(true);
    const name = fragment.querySelector(".collection-name");
    const detail = fragment.querySelector(".collection-detail");
    const pinBadge = fragment.querySelector(".pin-badge");
    const preview = fragment.querySelector(".tab-preview");
    const editor = fragment.querySelector(".editor");
    const editorName = fragment.querySelector(".collection-edit-name");
    const editorTabs = fragment.querySelector(".editor-tabs");
    const openButton = fragment.querySelector("[data-role='open']");
    const editButton = fragment.querySelector("[data-role='toggle-edit']");
    const pinButton = fragment.querySelector("[data-role='pin']");
    const deleteButton = fragment.querySelector("[data-role='delete']");

    applyTranslations(fragment);

    name.textContent = collection.name;
    detail.textContent = t("detailTabsUpdatedAt", [
      String(collection.tabs.length),
      formatDate(collection.updatedAt)
    ]);
    pinBadge.hidden = !collection.pinned;
    pinButton.textContent = collection.pinned ? t("unpin") : t("pin");

    for (const tab of collection.tabs.slice(0, 3)) {
      const item = document.createElement("li");
      item.textContent = tab.title;
      preview.appendChild(item);
    }

    if (collection.tabs.length === 0) {
      const emptyPreview = document.createElement("li");
      emptyPreview.textContent = t("previewEmptyFavorite");
      preview.appendChild(emptyPreview);
    }

    if (collection.tabs.length > 3) {
      const more = document.createElement("li");
      more.textContent = t("previewMoreTabs", [String(collection.tabs.length - 3)]);
      preview.appendChild(more);
    }

    openButton.dataset.collectionId = collection.id;
    editButton.dataset.collectionId = collection.id;
    pinButton.dataset.collectionId = collection.id;
    deleteButton.dataset.collectionId = collection.id;
    editor.dataset.collectionId = collection.id;
    editor.hidden = editingCollectionId !== collection.id;
    editButton.textContent = editingCollectionId === collection.id ? t("collapse") : t("edit");
    editorName.value = collection.name;

    for (const tab of collection.tabs) {
      addEditorTabRow(editorTabs, tab);
    }

    if (collection.tabs.length === 0) {
      addEditorTabRow(editorTabs);
    }

    collectionList.appendChild(fragment);
  }
}

function applyStaticTranslations() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  applyTranslations(document);
}

function applyTranslations(root) {
  for (const element of root.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }

  for (const element of root.querySelectorAll("[data-i18n-placeholder]")) {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  }
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleString(chrome.i18n.getUILanguage());
}

function downloadJson(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");

  link.href = url;
  link.download = `tab-saver-export-${timestamp}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showStatus(message) {
  statusMessage.hidden = false;
  statusMessage.textContent = message;
}

function showError(error) {
  console.error(error);
  statusMessage.hidden = false;
  statusMessage.textContent = error.message || t("unknownError");
}

function addEditorTabRow(container, tab = {}) {
  if (!container) {
    return;
  }

  const row = document.createElement("div");
  row.className = "editor-tab";
  row.innerHTML = `
    <div class="editor-tab-grid">
      <input type="text" data-field="title" placeholder="${escapeHtml(t("itemTitlePlaceholder"))}" value="${escapeHtml(tab.title || "")}" />
      <input type="url" data-field="url" placeholder="${escapeHtml(t("itemUrlPlaceholder"))}" value="${escapeHtml(tab.url || "")}" />
    </div>
    <div class="editor-tab-actions">
      <button type="button" class="ghost danger small-button" data-role="remove-tab">${escapeHtml(t("deleteItem"))}</button>
    </div>
  `;

  container.appendChild(row);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function withButtonBusy(button, busyText, action) {
  const idleText = button.textContent;
  button.disabled = true;
  button.textContent = busyText;

  try {
    await action();
  } finally {
    button.disabled = false;
    button.textContent = idleText;
  }
}

function sendMessage(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || t("unknownError")));
        return;
      }

      resolve(response.data);
    });
  });
}

function t(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key;
}
