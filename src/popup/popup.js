const collectionNameInput = document.querySelector("#collection-name");
const quickSaveButton = document.querySelector("#quick-save-button");
const saveButton = document.querySelector("#save-button");
const exportButton = document.querySelector("#export-button");
const importButton = document.querySelector("#import-button");
const importFileInput = document.querySelector("#import-file");
const collectionCount = document.querySelector("#collection-count");
const emptyState = document.querySelector("#empty-state");
const collectionList = document.querySelector("#collection-list");
const statusMessage = document.querySelector("#status-message");
const template = document.querySelector("#collection-item-template");

initialize().catch(showError);

quickSaveButton.addEventListener("click", async () => {
  try {
    await withButtonBusy(quickSaveButton, "保存中...", async () => {
      const collections = await sendMessage("SAVE_CURRENT_WINDOW");
      renderCollections(collections);
      showStatus("当前已打开的全部 Tab 已一键保存。");
    });
  } catch (error) {
    showError(error);
  }
});

saveButton.addEventListener("click", async () => {
  try {
    await withButtonBusy(saveButton, "保存中...", async () => {
      const collections = await sendMessage("SAVE_CURRENT_WINDOW", {
        name: collectionNameInput.value
      });

      collectionNameInput.value = "";
      renderCollections(collections);
      showStatus("当前窗口已保存到新的 Collection。");
    });
  } catch (error) {
    showError(error);
  }
});

exportButton.addEventListener("click", async () => {
  try {
    await withButtonBusy(exportButton, "导出中...", async () => {
      const payload = await sendMessage("EXPORT_DATA");
      downloadJson(payload);
      showStatus("收藏数据已导出。");
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
    showStatus("导入完成，Collection 已合并到当前数据。");
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

  const collectionId = target.dataset.collectionId;
  if (!collectionId) {
    return;
  }

  try {
    switch (target.dataset.role) {
      case "open":
        await withButtonBusy(target, "打开中...", async () => {
          await sendMessage("OPEN_COLLECTION", { collectionId });
          showStatus("已在新窗口中打开这个 Collection。");
        });
        break;
      case "pin": {
        const collections = await sendMessage("TOGGLE_COLLECTION_PINNED", { collectionId });
        renderCollections(collections);
        showStatus("Collection 置顶状态已更新。");
        break;
      }
      case "delete": {
        const collections = await sendMessage("DELETE_COLLECTION", { collectionId });
        renderCollections(collections);
        showStatus("Collection 已删除。");
        break;
      }
      default:
        break;
    }
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
    const openButton = fragment.querySelector("[data-role='open']");
    const pinButton = fragment.querySelector("[data-role='pin']");
    const deleteButton = fragment.querySelector("[data-role='delete']");

    name.textContent = collection.name;
    detail.textContent = `${collection.tabs.length} 个标签页 | ${formatDate(collection.updatedAt)}`;
    pinBadge.hidden = !collection.pinned;
    pinButton.textContent = collection.pinned ? "取消置顶" : "置顶";

    for (const tab of collection.tabs.slice(0, 3)) {
      const item = document.createElement("li");
      item.textContent = tab.title;
      preview.appendChild(item);
    }

    if (collection.tabs.length === 0) {
      const emptyPreview = document.createElement("li");
      emptyPreview.textContent = "这个 Collection 里还没有可打开的标签页。";
      preview.appendChild(emptyPreview);
    }

    if (collection.tabs.length > 3) {
      const more = document.createElement("li");
      more.textContent = `还有 ${collection.tabs.length - 3} 个标签页...`;
      preview.appendChild(more);
    }

    openButton.dataset.collectionId = collection.id;
    pinButton.dataset.collectionId = collection.id;
    deleteButton.dataset.collectionId = collection.id;

    collectionList.appendChild(fragment);
  }
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleString();
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
  statusMessage.textContent = error.message || "发生未知错误。";
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
        reject(new Error(response?.error || "Unknown error."));
        return;
      }

      resolve(response.data);
    });
  });
}
