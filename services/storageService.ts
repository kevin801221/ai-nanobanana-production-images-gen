
import { GenerationHistory, SavedCreation, BrandKit } from '../types';

const DB_NAME = 'ProductSceneDB';
const DB_VERSION = 2; // Incremented for Brand Kit
const STORE_HISTORY = 'history';
const STORE_FAVORITES = 'favorites';
const STORE_BRAND_KIT = 'brandKit';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
        db.createObjectStore(STORE_FAVORITES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_BRAND_KIT)) {
        db.createObjectStore(STORE_BRAND_KIT, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveHistoryItems = async (items: GenerationHistory[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_HISTORY, 'readwrite');
  const store = tx.objectStore(STORE_HISTORY);
  
  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => {
      items.forEach(item => store.add(item));
      resolve();
    };
    clearRequest.onerror = () => reject(clearRequest.error);
  });
};

export const getHistoryItems = async (): Promise<GenerationHistory[]> => {
  const db = await openDB();
  const tx = db.transaction(STORE_HISTORY, 'readonly');
  const store = tx.objectStore(STORE_HISTORY);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const results = request.result as GenerationHistory[];
      resolve(results.sort((a, b) => b.timestamp - a.timestamp));
    };
    request.onerror = () => reject(request.error);
  });
};

export const saveFavoriteItems = async (items: SavedCreation[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_FAVORITES, 'readwrite');
  const store = tx.objectStore(STORE_FAVORITES);

  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => {
      items.forEach(item => store.add(item));
      resolve();
    };
    clearRequest.onerror = () => reject(clearRequest.error);
  });
};

export const getFavoriteItems = async (): Promise<SavedCreation[]> => {
  const db = await openDB();
  const tx = db.transaction(STORE_FAVORITES, 'readonly');
  const store = tx.objectStore(STORE_FAVORITES);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const results = request.result as SavedCreation[];
      resolve(results.sort((a, b) => b.timestamp - a.timestamp));
    };
    request.onerror = () => reject(request.error);
  });
};

export const saveBrandKit = async (kit: BrandKit): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_BRAND_KIT, 'readwrite');
  const store = tx.objectStore(STORE_BRAND_KIT);
  
  await new Promise<void>((resolve, reject) => {
    // We only store one kit with a fixed ID
    store.put({ id: 'main', ...kit });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getBrandKit = async (): Promise<BrandKit | null> => {
  const db = await openDB();
  const tx = db.transaction(STORE_BRAND_KIT, 'readonly');
  const store = tx.objectStore(STORE_BRAND_KIT);
  const request = store.get('main');

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      if (request.result) {
        // Remove the ID before returning to match interface (optional but clean)
        const { id, ...kit } = request.result;
        resolve(kit as BrandKit);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
};
