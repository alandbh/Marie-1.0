
const DB_NAME = 'RGA_UX_Analyst_DB';
const DB_VERSION = 1;
const STORE_FILES = 'files'; // Store for large JSONs

// Keys for LocalStorage
const KEY_API_URL = 'rga_api_url';
const KEY_RESULTS_API_KEY = 'rga_results_api_key';

export interface PersistedData {
  heuristicasContent: any | null;
  resultadosContent: any | null;
  apiUrl: string;
  resultsApiKey: string;
}

// IndexedDB Helper
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const StorageService = {
  // --- LocalStorage (Config Strings) ---
  saveConfig: (apiUrl: string, resultsApiKey: string) => {
    localStorage.setItem(KEY_API_URL, apiUrl);
    localStorage.setItem(KEY_RESULTS_API_KEY, resultsApiKey);
  },

  loadConfig: () => {
    return {
      apiUrl: localStorage.getItem(KEY_API_URL) || '',
      resultsApiKey: localStorage.getItem(KEY_RESULTS_API_KEY) || ''
    };
  },

  // --- IndexedDB (Large JSON Files) ---
  saveFile: async (key: 'heuristicas' | 'resultados', content: any) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_FILES, 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      store.put(content, key);
      return new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error("Error saving file to IndexedDB:", e);
    }
  },

  loadFile: async (key: 'heuristicas' | 'resultados'): Promise<any | null> => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      const request = store.get(key);
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error("Error loading file from IndexedDB:", e);
      return null;
    }
  },

  // --- Facade ---
  saveAll: async (heuristicas: any, resultados: any, apiUrl: string, resultsApiKey: string) => {
    StorageService.saveConfig(apiUrl, resultsApiKey);
    if (heuristicas) await StorageService.saveFile('heuristicas', heuristicas);
    if (resultados) await StorageService.saveFile('resultados', resultados);
  },

  loadAll: async (): Promise<PersistedData> => {
    const config = StorageService.loadConfig();
    const heuristicas = await StorageService.loadFile('heuristicas');
    const resultados = await StorageService.loadFile('resultados');

    return {
      apiUrl: config.apiUrl,
      resultsApiKey: config.resultsApiKey,
      heuristicasContent: heuristicas,
      resultadosContent: resultados
    };
  },

  clearAll: async () => {
    localStorage.removeItem(KEY_API_URL);
    localStorage.removeItem(KEY_RESULTS_API_KEY);
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, 'readwrite');
    tx.objectStore(STORE_FILES).clear();
    return new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
  }
};
