import { getTranslator } from "./lib/i18n.js";
import {
  createCollection,
  deleteCollection,
  exportCollections,
  getCollections,
  importCollections,
  toggleCollectionLocked,
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
  const { t } = await getTranslator();

  switch (message?.type) {
    case "GET_COLLECTIONS":
      return getCollections();
    case "SAVE_CURRENT_TAB":
      return saveCurrentTab(t);
    case "SAVE_ALL_TABS":
      return saveAllTabs(t);
    case "OPEN_COLLECTION":
      return openCollection(message.payload?.collectionId, t);
    case "UPDATE_COLLECTION":
      return updateCollection(message.payload?.collectionId, message.payload?.updates);
    case "DELETE_COLLECTION":
      return deleteCollection(message.payload?.collectionId);
    case "TOGGLE_COLLECTION_LOCKED":
      return toggleCollectionLocked(message.payload?.collectionId);
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

async function saveCurrentTab(t) {
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

async function saveAllTabs(t) {
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

async function openCollection(collectionId, t) {
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
