const COLLECTIONS_KEY = "tabSaverCollections";
const LEGACY_SESSIONS_KEY = "savedTabSessions";

export async function getCollections() {
  const stored = await chrome.storage.local.get([COLLECTIONS_KEY, LEGACY_SESSIONS_KEY]);
  const collections = stored[COLLECTIONS_KEY];

  if (Array.isArray(collections)) {
    return sortCollections(collections);
  }

  const legacySessions = Array.isArray(stored[LEGACY_SESSIONS_KEY]) ? stored[LEGACY_SESSIONS_KEY] : [];
  const migratedCollections = legacySessions.map(normalizeLegacySession);

  await chrome.storage.local.set({
    [COLLECTIONS_KEY]: migratedCollections
  });

  return sortCollections(migratedCollections);
}

export async function createCollection(collectionInput) {
  const collections = await getCollections();
  const now = new Date().toISOString();
  const collection = {
    id: collectionInput.id ?? crypto.randomUUID(),
    name: collectionInput.name?.trim() || "Untitled Collection",
    pinned: Boolean(collectionInput.pinned),
    createdAt: collectionInput.createdAt ?? now,
    updatedAt: collectionInput.updatedAt ?? now,
    tabs: normalizeTabs(collectionInput.tabs)
  };

  const nextCollections = sortCollections([collection, ...collections]);
  await persistCollections(nextCollections);
  return nextCollections;
}

export async function deleteCollection(collectionId) {
  const collections = await getCollections();
  const nextCollections = collections.filter((collection) => collection.id !== collectionId);

  await persistCollections(nextCollections);
  return nextCollections;
}

export async function toggleCollectionPinned(collectionId) {
  const collections = await getCollections();
  const nextCollections = sortCollections(
    collections.map((collection) =>
      collection.id === collectionId
        ? {
            ...collection,
            pinned: !collection.pinned,
            updatedAt: new Date().toISOString()
          }
        : collection
    )
  );

  await persistCollections(nextCollections);
  return nextCollections;
}

export async function exportCollections() {
  const collections = await getCollections();

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    collections
  };
}

export async function importCollections(importPayload) {
  const importedCollections = normalizeImportedCollections(importPayload);
  const currentCollections = await getCollections();
  const collectionMap = new Map();

  for (const collection of currentCollections) {
    collectionMap.set(collection.id, collection);
  }

  for (const collection of importedCollections) {
    collectionMap.set(collection.id, collection);
  }

  const nextCollections = sortCollections([...collectionMap.values()]);
  await persistCollections(nextCollections);
  return nextCollections;
}

function normalizeImportedCollections(importPayload) {
  const rawCollections = Array.isArray(importPayload?.collections)
    ? importPayload.collections
    : Array.isArray(importPayload)
      ? importPayload
      : null;

  if (!rawCollections) {
    throw new Error("Import file is invalid.");
  }

  return rawCollections.map((collection) => ({
    id: collection.id ?? crypto.randomUUID(),
    name: collection.name?.trim() || "Imported Collection",
    pinned: Boolean(collection.pinned),
    createdAt: collection.createdAt ?? new Date().toISOString(),
    updatedAt: collection.updatedAt ?? collection.createdAt ?? new Date().toISOString(),
    tabs: normalizeTabs(collection.tabs)
  }));
}

function normalizeLegacySession(session) {
  return {
    id: session.id ?? crypto.randomUUID(),
    name: session.name?.trim() || "Imported Session",
    pinned: false,
    createdAt: session.createdAt ?? new Date().toISOString(),
    updatedAt: session.createdAt ?? new Date().toISOString(),
    tabs: normalizeTabs(session.tabs)
  };
}

function normalizeTabs(tabs) {
  if (!Array.isArray(tabs)) {
    return [];
  }

  return tabs
    .map((tab) => ({
      title: tab?.title || "Untitled Tab",
      url: typeof tab?.url === "string" ? tab.url : "",
      favIconUrl: typeof tab?.favIconUrl === "string" ? tab.favIconUrl : ""
    }))
    .filter((tab) => tab.url);
}

async function persistCollections(collections) {
  await chrome.storage.local.set({
    [COLLECTIONS_KEY]: collections
  });
}

function sortCollections(collections) {
  return [...collections].sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return Number(right.pinned) - Number(left.pinned);
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}
