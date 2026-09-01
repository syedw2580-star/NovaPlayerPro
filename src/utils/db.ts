// IndexedDB helper for Powerhouse Video Player

const DB_NAME = 'PowerhouseVideoPlayerDB';
const DB_VERSION = 1;
const STORE_NAME = 'videos';
const STATE_STORE = 'app_state';

export interface SavedVideo {
  id: string;
  title: string;
  fileBlob?: Blob;
  addedAt: number;
  category: string;
  subtitleText?: string;
  subtitleName?: string;
  url?: string;
}

export function initDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB is not supported in this browser environment.');
      resolve(null);
      return;
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('Database failed to open:', event);
        resolve(null);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STATE_STORE)) {
          db.createObjectStore(STATE_STORE);
        }
      };
    } catch (e) {
      console.error('Error initializing IndexedDB:', e);
      resolve(null);
    }
  });
}

export async function saveVideoToDB(video: SavedVideo): Promise<boolean> {
  const db = await initDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(video);

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.error('Error saving video to DB:', request.error);
        resolve(false);
      };
    } catch (e) {
      console.error('Transaction failure:', e);
      resolve(false);
    }
  });
}

export async function getVideosFromDB(): Promise<SavedVideo[]> {
  const db = await initDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => {
        console.error('Error getting videos:', request.error);
        resolve([]);
      };
    } catch (e) {
      console.error('Transaction failure:', e);
      resolve([]);
    }
  });
}

export async function deleteVideoFromDB(id: string): Promise<boolean> {
  const db = await initDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.error('Error deleting video:', request.error);
        resolve(false);
      };
    } catch (e) {
      console.error('Transaction failure:', e);
      resolve(false);
    }
  });
}

export async function saveAppState(key: string, value: any): Promise<boolean> {
  const db = await initDB();
  if (!db) {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STATE_STORE], 'readwrite');
      const store = transaction.objectStore(STATE_STORE);
      const request = store.put(value, key);

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        console.error('Error saving app state:', request.error);
        resolve(false);
      };
    } catch (e) {
      console.error('Transaction failure saving app state:', e);
      resolve(false);
    }
  });
}

export async function getAppState(key: string): Promise<any> {
  const db = await initDB();
  if (!db) {
    try {
      const val = localStorage.getItem(key);
      if (!val) return null;
      try {
        return JSON.parse(val);
      } catch (e) {
        return val;
      }
    } catch (e) {
      return null;
    }
  }

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction([STATE_STORE], 'readonly');
      const store = transaction.objectStore(STATE_STORE);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error('Error getting app state:', request.error);
        resolve(null);
      };
    } catch (e) {
      console.error('Transaction failure reading app state:', e);
      resolve(null);
    }
  });
}
