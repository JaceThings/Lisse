// Minimal ambient surface for the WebExtension APIs we use — avoids a
// @types/chrome dependency. Firefox aliases `chrome` to `browser`.
interface StorageArea {
  get(keys: string | string[] | Record<string, unknown> | null): Promise<Record<string, any>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

interface Tab {
  id?: number;
  url?: string;
}

declare const chrome: {
  runtime: {
    getURL(path: string): string;
  };
  storage: {
    sync: StorageArea;
    onChanged: {
      addListener(cb: (changes: Record<string, StorageChange>, area: string) => void): void;
    };
  };
  tabs: {
    query(q?: Record<string, unknown>): Promise<Tab[]>;
    get(tabId: number): Promise<Tab>;
    onActivated: { addListener(cb: (info: { tabId: number }) => void): void };
    onUpdated: {
      addListener(cb: (tabId: number, changeInfo: { url?: string; status?: string }, tab: Tab) => void): void;
    };
  };
  action: {
    onClicked: { addListener(cb: (tab: Tab) => void): void };
    setIcon(details: { tabId?: number; path?: string | Record<number, string> }): Promise<void>;
  };
};
