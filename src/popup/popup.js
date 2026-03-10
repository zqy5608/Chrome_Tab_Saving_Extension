import { getStoredLocale, getTranslator, setStoredLocale } from "../lib/i18n.js";

const saveCurrentTabButton = document.querySelector("#save-current-tab-button");
const saveAllTabsButton = document.querySelector("#save-all-tabs-button");
const exportButton = document.querySelector("#export-button");
const importButton = document.querySelector("#import-button");
const importFileInput = document.querySelector("#import-file");
const languageSelect = document.querySelector("#language-select");
const collectionCount = document.querySelector("#collection-count");
const emptyState = document.querySelector("#empty-state");
const collectionList = document.querySelector("#collection-list");
const statusMessage = document.querySelector("#status-message");
const template = document.querySelector("#collection-item-template");

let currentLocale = "en";
let translator = {
  locale: "en",
  t(key) {
    return key;
  }
};
let editingCollectionId = null;
let statusTimeoutId = null;
const expandedPreviewIds = new Set();

await initializeLocalization();
bindEvents();
initialize().catch(showError);

function bindEvents() {
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

  languageSelect.addEventListener("change", async () => {
    try {
      const nextLocale = await setStoredLocale(languageSelect.value);
      await initializeLocalization(nextLocale);
      clearStatus();
      renderCollections(await sendMessage("GET_COLLECTIONS"));
    } catch (error) {
      showError(error);
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
          if (!collectionId || target.disabled) {
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
        case "toggle-lock":
          if (!collectionId) {
            return;
          }
          if (editingCollectionId === collectionId) {
            editingCollectionId = null;
          }
          renderCollections(await sendMessage("TOGGLE_COLLECTION_LOCKED", { collectionId }));
          showStatus(t("statusLockUpdated"));
          break;
        case "toggle-preview":
          if (!collectionId) {
            return;
          }
          if (expandedPreviewIds.has(collectionId)) {
            expandedPreviewIds.delete(collectionId);
          } else {
            expandedPreviewIds.add(collectionId);
          }
          renderCollections(await sendMessage("GET_COLLECTIONS"));
          break;
        case "delete":
          if (!collectionId) {
            return;
          }
          if (!window.confirm(t("confirmDeleteFavorite"))) {
            return;
          }
          expandedPreviewIds.delete(collectionId);
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
}

async function initializeLocalization(preferredLocale) {
  const storedLocale = preferredLocale || (await getStoredLocale());
  translator = await getTranslator(storedLocale);
  currentLocale = translator.locale;
  document.documentElement.lang = currentLocale === "zh_CN" ? "zh-CN" : "en";
  languageSelect.value = currentLocale;
  applyTranslations(document);
}

async function initialize() {
  clearStatus();
  const collections = await sendMessage("GET_COLLECTIONS");
  renderCollections(collections);
}

function renderCollections(collections) {
  collectionList.textContent = "";
  collectionCount.textContent = String(collections.length);
  emptyState.hidden = collections.length > 0;

  for (const collection of collections) {
    const fragment = template.content.cloneNode(true);
    const item = fragment.querySelector(".collection-item");
    const name = fragment.querySelector(".collection-name");
    const tabCount = fragment.querySelector(".collection-tab-count");
    const updatedAt = fragment.querySelector(".collection-updated-at");
    const pinBadge = fragment.querySelector(".pin-badge");
    const lockBadge = fragment.querySelector(".lock-badge");
    const preview = fragment.querySelector(".tab-preview");
    const previewToggle = fragment.querySelector("[data-role='toggle-preview']");
    const editor = fragment.querySelector(".editor");
    const editorName = fragment.querySelector(".collection-edit-name");
    const editorTabs = fragment.querySelector(".editor-tabs");
    const openButton = fragment.querySelector("[data-role='open']");
    const editButton = fragment.querySelector("[data-role='toggle-edit']");
    const lockButton = fragment.querySelector("[data-role='toggle-lock']");
    const pinButton = fragment.querySelector("[data-role='pin']");
    const deleteButton = fragment.querySelector("[data-role='delete']");

    applyTranslations(fragment);

    name.textContent = collection.name;
    tabCount.textContent = t("tabCountLabel", [String(collection.tabs.length)]);
    updatedAt.textContent = formatDate(collection.updatedAt);
    const isPinned = Boolean(collection.pinned);
    const isLocked = Boolean(collection.locked);
    const isExpanded = expandedPreviewIds.has(collection.id);
    pinBadge.hidden = !isPinned;
    lockBadge.hidden = !isLocked;
    pinButton.textContent = isPinned ? t("unpin") : t("pin");
    lockButton.textContent = isLocked ? t("unlock") : t("lock");
    item.classList.toggle("is-locked", isLocked);

    const previewTabs = isExpanded ? collection.tabs : collection.tabs.slice(0, 4);
    for (const tab of previewTabs) {
      const previewItem = document.createElement("li");
      previewItem.textContent = tab.title;
      preview.appendChild(previewItem);
    }

    if (collection.tabs.length === 0) {
      const emptyPreview = document.createElement("li");
      emptyPreview.textContent = t("previewEmptyFavorite");
      preview.appendChild(emptyPreview);
    }

    if (!isExpanded && collection.tabs.length > 4) {
      const more = document.createElement("li");
      more.className = "tab-preview-more";
      more.textContent = t("previewMoreTabs", [String(collection.tabs.length - 4)]);
      preview.appendChild(more);
    }

    openButton.dataset.collectionId = collection.id;
    editButton.dataset.collectionId = collection.id;
    lockButton.dataset.collectionId = collection.id;
    pinButton.dataset.collectionId = collection.id;
    deleteButton.dataset.collectionId = collection.id;
    previewToggle.dataset.collectionId = collection.id;
    editor.dataset.collectionId = collection.id;
    editor.hidden = editingCollectionId !== collection.id || isLocked;
    editButton.textContent = editingCollectionId === collection.id && !isLocked ? t("collapse") : t("edit");
    editorName.value = collection.name;
    editButton.disabled = isLocked;
    pinButton.disabled = isLocked;
    deleteButton.disabled = isLocked;
    previewToggle.hidden = collection.tabs.length <= 4;
    previewToggle.textContent = isExpanded ? t("collapseTabs") : t("expandTabs");

    for (const tab of collection.tabs) {
      addEditorTabRow(editorTabs, tab);
    }

    if (collection.tabs.length === 0) {
      addEditorTabRow(editorTabs);
    }

    if (isLocked) {
      editorName.disabled = true;
      for (const input of editorTabs.querySelectorAll("input, button")) {
        input.disabled = true;
      }
    }

    collectionList.appendChild(fragment);
  }
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
  const locale = currentLocale === "zh_CN" ? "zh-CN" : "en-US";
  return new Date(isoString).toLocaleString(locale);
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
  if (statusTimeoutId) {
    clearTimeout(statusTimeoutId);
  }

  statusMessage.hidden = false;
  statusMessage.textContent = message;
  statusTimeoutId = setTimeout(() => {
    clearStatus();
  }, 3000);
}

function showError(error) {
  console.error(error);
  if (statusTimeoutId) {
    clearTimeout(statusTimeoutId);
  }
  statusMessage.hidden = false;
  statusMessage.textContent = error.message || t("unknownError");
}

function clearStatus() {
  statusMessage.hidden = true;
  statusMessage.textContent = "";
  statusTimeoutId = null;
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
  button.dataset.busy = "true";
  button.textContent = busyText;

  try {
    await action();
  } finally {
    button.disabled = false;
    delete button.dataset.busy;
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
  return translator.t(key, substitutions);
}
