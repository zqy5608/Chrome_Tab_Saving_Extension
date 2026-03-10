import {
  createCollection,
  deleteCollection,
  exportCollections,
  getCollections,
  importCollections,
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
    case "SAVE_CURRENT_WINDOW":
      return saveCurrentWindow(message.payload?.name);
    case "OPEN_COLLECTION":
      return openCollection(message.payload?.collectionId);
    case "DELETE_COLLECTION":
      return deleteCollection(message.payload?.collectionId);
    case "TOGGLE_COLLECTION_PINNED":
      return toggleCollectionPinned(message.payload?.collectionId);
    case "EXPORT_DATA":
      return exportCollections();
    case "IMPORT_DATA":
      return importCollections(message.payload);
    default:
      throw new Error("Unsupported message type.");
  }
}

async function saveCurrentWindow(customName) {
  const currentWindowTabs = await chrome.tabs.query({ currentWindow: true });
  const now = new Date();

  return createCollection({
    name: customName?.trim() || `Collection ${now.toLocaleString()}`,
    tabs: currentWindowTabs.map((tab) => ({
      title: tab.title || "Untitled Tab",
      url: tab.url || "",
      favIconUrl: tab.favIconUrl || ""
    }))
  });
}

async function openCollection(collectionId) {
  const collections = await getCollections();
  const collection = collections.find((item) => item.id === collectionId);

  if (!collection) {
    throw new Error("Collection not found.");
  }

  const urls = collection.tabs.map((tab) => tab.url).filter(Boolean);
  if (urls.length === 0) {
    throw new Error("This collection has no valid tabs.");
  }

  await chrome.windows.create({ url: urls });
  return collections;
}
