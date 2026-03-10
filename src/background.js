import {
  createCollection,
  deleteCollection,
  exportCollections,
  getCollections,
  importCollections,
  updateCollection,
  toggleCollectionPinned
} from "./lib/storage.js";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Tab Saver installed.");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => {
      console.error(error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

async function handleMessage(message) {
  switch (message?.type) {
    case "GET_COLLECTIONS":
      return getCollections();
    case "SAVE_CURRENT_TAB":
      return saveCurrentTab();
    case "SAVE_ALL_TABS":
      return saveAllTabs();
    case "OPEN_COLLECTION":
      return openCollection(message.payload?.collectionId);
    case "UPDATE_COLLECTION":
      return updateCollection(message.payload?.collectionId, message.payload?.updates);
    case "DELETE_COLLECTION":
      return deleteCollection(message.payload?.collectionId);
    case "TOGGLE_COLLECTION_PINNED":
      return toggleCollectionPinned(message.payload?.collectionId);
    case "EXPORT_DATA":
      return exportCollections();
    case "IMPORT_DATA":
      return importCollections(message.payload);
    default:
      throw new Error(t("errorUnsupportedMessage"));
  }
}

async function saveCurrentTab() {
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const now = new Date();
  const currentTab = activeTabs[0];

  return createCollection({
    name: t("defaultCurrentTabCollectionName", [now.toLocaleString()]),
    tabs: currentTab
      ? [
          {
            title: currentTab.title || t("defaultUntitledTab"),
            url: currentTab.url || "",
            favIconUrl: currentTab.favIconUrl || ""
          }
        ]
      : []
  });
}

async function saveAllTabs() {
  const tabs = await chrome.tabs.query({});
  const now = new Date();

  return createCollection({
    name: t("defaultAllTabsCollectionName", [now.toLocaleString()]),
    tabs: tabs.map((tab) => ({
      title: tab.title || t("defaultUntitledTab"),
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || ""
    }))
  });
}

async function openCollection(collectionId) {
  const collections = await getCollections();
  const collection = collections.find((item) => item.id === collectionId);

  if (!collection) {
    throw new Error(t("errorCollectionNotFound"));
  }

  const urls = collection.tabs.map((tab) => tab.url).filter(Boolean);
  if (urls.length === 0) {
    throw new Error(t("errorNoValidTabs"));
  }

  await chrome.windows.create({ url: urls });
  return collections;
}

function t(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key;
}
