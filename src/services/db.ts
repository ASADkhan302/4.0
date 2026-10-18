/**
 * ULM Central Campus Library Management System
 * Unified Database Bridge & Scale Service (src/services/db.ts)
 *
 * Unlimited Full-Library Scale (1,00,000+ / 10,00,000+ Books):
 * - Direct access to native SQLite and IndexedDB database stores
 * - Zero 5,000-book caps (uses Number.MAX_SAFE_INTEGER for all collection queries)
 * - True real-time book counting across both desktop and browser environments
 */

import { getTrueDatabaseBookCount, UlmBookRecord } from './libraryStorageAndMigration';

export const UNLIMITED_LIMIT = Number.MAX_SAFE_INTEGER;

export interface DatabaseStats {
  totalBooks: number;
  availableBooks: number;
  issuedBooks: number;
  storageEngine: 'SQLite' | 'IndexedDB';
}

/**
 * Returns the true total book count directly from SQLite or IndexedDB store.count(),
 * bypassing any localStorage 5,000-book quota ceiling.
 */
export async function getLiveDatabaseTotalBooks(): Promise<number> {
  return getTrueDatabaseBookCount();
}

/**
 * Executes a fast, paginated database query without in-memory truncation.
 */
export async function queryBooksFromDatabase(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  exportAll?: boolean;
}): Promise<{ items: UlmBookRecord[]; total: number }> {
  const bridge = typeof window !== 'undefined'
    ? (window.ulmLibraryApi || (window as any).ulmElectronSqlite)
    : null;

  if (bridge && typeof bridge.queryBooks === 'function') {
    const res = await bridge.queryBooks({
      page: params.page || 1,
      pageSize: params.exportAll ? UNLIMITED_LIMIT : (params.pageSize || 50),
      search: params.search,
      category: params.category,
      exportAll: Boolean(params.exportAll),
    });
    return { items: res.items, total: res.total };
  }

  return { items: [], total: 0 };
}
