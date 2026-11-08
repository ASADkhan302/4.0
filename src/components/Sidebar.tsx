import React, { useState, useEffect } from 'react';
import { 
  Search, 
  BookOpen, 
  ArrowRightLeft, 
  Users, 
  BarChart3, 
  QrCode, 
  FileSpreadsheet, 
  Settings, 
  PanelLeftClose,
  PanelLeftOpen,
  Command,
  X,
  Library
} from 'lucide-react';
import { NavigationTab, Book } from '../types/library';

export type LmsNavItemData = {
  id: NavigationTab | 'search';
  title: string;
  icon: React.ElementType;
  badge?: number | string;
  shortcut?: string;
  children?: LmsNavItemData[];
};

export type LmsNavGroupData = {
  heading?: string;
  items: LmsNavItemData[];
};

export interface LmsSidebarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  totalBooksCount: number;
  activeLoansCount: number;
  totalBorrowersCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isSearchOpen?: boolean;
  onToggleSearch?: (open: boolean) => void;
  catalogBooks?: Book[];
  onSelectBook?: (book: Book) => void;
  universityName?: string;
  libraryName?: string;
}

export function Sidebar({
  activeTab,
  onTabChange,
  totalBooksCount,
  activeLoansCount,
  totalBorrowersCount,
  isCollapsed,
  onToggleCollapse,
  isSearchOpen: externalIsSearchOpen,
  onToggleSearch,
  catalogBooks = [],
  onSelectBook,
}: LmsSidebarProps) {
  const [internalIsSearchOpen, setInternalIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [windowDimensions, setWindowDimensions] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isShortScreen = windowDimensions.height < 800;
  const isRail = isCollapsed;

  const isSearchOpen = externalIsSearchOpen !== undefined ? externalIsSearchOpen : internalIsSearchOpen;
  const setIsSearchOpen = (open: boolean) => {
    if (onToggleSearch) {
      onToggleSearch(open);
    } else {
      setInternalIsSearchOpen(open);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(!isSearchOpen);
        return;
      }

      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b' && !isInputFocused) {
        e.preventDefault();
        onToggleCollapse();
        return;
      }

      // Hotkey switches (including Cmd+A for Almari view)
      if ((e.metaKey || e.ctrlKey) && !isInputFocused) {
        if (e.key === '1') { e.preventDefault(); onTabChange('catalog'); }
        else if (e.key.toLowerCase() === 'a') { e.preventDefault(); onTabChange('almaris'); }
        else if (e.key === '2') { e.preventDefault(); onTabChange('scanner'); }
        else if (e.key === '3') { e.preventDefault(); onTabChange('circulation'); }
        else if (e.key === '4') { e.preventDefault(); onTabChange('borrowers'); }
        else if (e.key === '5') { e.preventDefault(); onTabChange('reports'); }
        else if (e.key === '6') { e.preventDefault(); onTabChange('excel'); }
        else if (e.key === ',') { e.preventDefault(); onTabChange('settings'); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, onTabChange, onToggleCollapse]);

  const navGroups: LmsNavGroupData[] = [
    {
      heading: 'CATALOG & INVENTORY',
      items: [
        { 
          id: 'catalog', 
          title: 'Books Catalog', 
          icon: BookOpen, 
          badge: totalBooksCount,
          shortcut: '⌘1'
        },
        { 
          id: 'almaris', 
          title: 'Manual Almari View', 
          icon: Library,
          shortcut: '⌘A'
        },
        { 
          id: 'scanner', 
          title: 'Barcode Station', 
          icon: QrCode,
          shortcut: '⌘2'
        },
      ]
    },
    {
      heading: 'CIRCULATION & CARDS',
      items: [
        { 
          id: 'circulation', 
          title: 'Issue / Return Desk', 
          icon: ArrowRightLeft, 
          badge: activeLoansCount > 0 ? activeLoansCount : undefined,
          shortcut: '⌘3'
        },
        { 
          id: 'borrowers', 
          title: 'Member ID Cards', 
          icon: Users, 
          badge: totalBorrowersCount,
          shortcut: '⌘4'
        },
      ]
    },
    {
      heading: 'ADMINISTRATION',
      items: [
        { id: 'reports', title: 'Reports & Audits', icon: BarChart3, shortcut: '⌘5' },
        { id: 'excel', title: 'Excel & PC Migration', icon: FileSpreadsheet, shortcut: '⌘6' },
      ]
    }
  ];

  const bottomItems: LmsNavItemData[] = [
    { id: 'settings', title: 'System Settings', icon: Settings, shortcut: '⌘,' },
  ];

  const handleItemClick = (id: NavigationTab | 'search') => {
    if (id === 'search') {
      setIsSearchOpen(true);
      return;
    }
    onTabChange(id as NavigationTab);
  };

  const getSidebarWidthClass = () => {
    if (isRail) {
      return 'w-[72px] min-w-[72px] max-w-[72px]';
    }
    return 'w-[240px] min-w-[240px] max-w-[240px]';
  };

  const itemHeightClass = isShortScreen ? 'h-[36px]' : 'h-[40px]';

  return (
    <>
      <aside 
        className={`shrink-0 h-full min-h-0 flex flex-col justify-between overflow-hidden select-none bg-white/60 dark:bg-[#120C1F]/65 backdrop-blur-2xl backdrop-saturate-200 border-r border-[#C8963E]/35 dark:border-white/10 shadow-[4px_0_24px_-4px_rgba(30,20,43,0.06)] text-slate-800 dark:text-slate-200 transition-[width] duration-200 ease-out relative z-20 no-print ${getSidebarWidthClass()}`}
      >
        {/* Top Header */}
        <div className="h-10 px-3 flex items-center justify-between border-b border-slate-200/70 dark:border-white/[0.06] shrink-0">
          {!isRail ? (
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">
              Navigation
            </span>
          ) : <div className="w-2" />}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
            title={isCollapsed ? "Expand Sidebar (⌘B)" : "Collapse Sidebar (⌘B)"}
            aria-label="Toggle Sidebar"
          >
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Scrollable Nav Items */}
        <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2.5 sm:px-3 flex flex-col [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#2B2730] [&::-webkit-scrollbar-thumb]:rounded-full ${
          isShortScreen ? 'py-2 gap-1' : 'py-3 gap-1.5'
        }`}>
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="flex flex-col gap-1">
              {group.heading && !isRail && (
                <span className={`px-3 mb-1 text-[11px] uppercase tracking-[0.08em] font-bold text-slate-500 dark:text-slate-400 select-none ${
                  isShortScreen ? 'mt-3' : 'mt-4'
                }`}>
                  {group.heading}
                </span>
              )}
              {isRail && group.heading && (
                <div className={`h-[1px] mx-3 bg-slate-200 dark:bg-white/[0.06] ${isShortScreen ? 'my-1.5' : 'my-2'}`} />
              )}
              {group.items.map(item => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    title={item.title}
                    className={`group relative flex items-center justify-between ${
                      isRail ? 'px-0 justify-center' : 'px-3 gap-3'
                    } ${itemHeightClass} rounded-[10px] cursor-pointer transition-all duration-150 text-left w-full border text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC881B] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0B1220] ${
                      isActive
                        ? 'bg-gradient-to-r from-[#541A72]/90 to-[#3B1054]/90 !text-white border-[#FFD147]/55 shadow-md backdrop-blur-md'
                        : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5 border-transparent'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FFD147] rounded-l-[10px]" />
                    )}

                    <div className="relative flex items-center gap-3 min-w-0">
                      <div className="relative flex items-center justify-center shrink-0">
                        <Icon 
                          className={`w-5 h-5 shrink-0 transition-colors ${
                            isActive 
                              ? 'text-[#FFD147]' 
                              : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-950 dark:group-hover:text-white'
                          }`} 
                          strokeWidth={1.75} 
                        />
                        {isRail && item.badge !== undefined && (
                          <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold bg-[#BC881B] text-black flex items-center justify-center leading-none shadow-xs pointer-events-none">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      {!isRail && (
                        <span 
                          className={`truncate text-[14px] leading-none ${isActive ? '!text-white font-semibold' : 'font-medium'}`}
                          title={item.title}
                        >
                          {item.title}
                        </span>
                      )}
                    </div>

                    {!isRail && (
                      <div className="relative flex items-center gap-2 ml-auto shrink-0">
                        {item.shortcut && (
                          <kbd className="hidden group-hover:inline-flex items-center justify-center h-5 px-1.5 text-[11px] font-mono rounded border border-[var(--border-subtle)] text-[var(--text-muted)] bg-black/10 dark:bg-black/30">
                            {item.shortcut}
                          </kbd>
                        )}
                        {item.badge !== undefined && (
                          <span className={`inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full font-mono text-xs font-semibold leading-none ${
                            isActive
                              ? 'bg-[#FFD147] text-slate-950 font-extrabold shadow-xs'
                              : 'bg-slate-200/90 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-white/10'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Pinned Bottom Items */}
        <div className={`border-t border-slate-200/70 dark:border-white/10 shrink-0 flex flex-col gap-1.5 ${
          isShortScreen ? 'p-2' : 'p-3'
        }`}>
          {bottomItems.map(item => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                title={item.title}
                className={`group relative flex items-center justify-between ${
                  isRail ? 'px-0 justify-center' : 'px-3 gap-3'
                } ${itemHeightClass} rounded-[10px] cursor-pointer transition-all duration-150 w-full border text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC881B] focus-visible:ring-offset-1 focus-visible:ring-offset-[#141214] ${
                  isActive
                    ? 'bg-gradient-to-r from-[#541A72]/90 to-[#3B1054]/90 !text-white border-[#FFD147]/55 shadow-md backdrop-blur-md' 
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5 border-transparent'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FFD147] rounded-l-[10px]" />
                )}
                <div className="relative flex items-center gap-3">
                  <Icon 
                    className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#FFD147]' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-950 dark:group-hover:text-white'}`} 
                    strokeWidth={1.75}
                  />
                  {!isRail && (
                    <span className={`truncate text-[14px] leading-none ${isActive ? '!text-white font-semibold' : 'font-medium'}`} title={item.title}>
                      {item.title}
                    </span>
                  )}
                </div>
                {!isRail && item.shortcut && (
                  <kbd className="hidden group-hover:inline-flex items-center justify-center h-5 px-1.5 text-[11px] font-mono rounded border border-[var(--border-subtle)] text-[var(--text-muted)] bg-black/10 dark:bg-black/30 ml-auto shrink-0">
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            );
          })}

          <button
            onClick={onToggleCollapse}
            title={isRail ? "Expand Sidebar" : "Collapse Sidebar"}
            className={`group relative flex items-center ${
              isRail ? 'justify-center px-0' : 'justify-between px-3 gap-3'
            } ${itemHeightClass} rounded-[10px] transition-all duration-150 w-full border border-transparent text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5 text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC881B] focus-visible:ring-offset-1 focus-visible:ring-offset-[#141214]`}
          >
            {isRail ? (
              <PanelLeftOpen className="w-5 h-5 text-[var(--text-accent)]" strokeWidth={1.75} />
            ) : (
              <div className="flex items-center justify-between w-full text-[14px] font-medium">
                <span>Collapse Sidebar</span>
                <PanelLeftClose className="w-5 h-5 text-[var(--text-muted)] group-hover:text-slate-900 dark:group-hover:text-white" strokeWidth={1.75} />
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* FIXED OVERLAY QUICK SEARCH MODAL (Command+K) */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="fixed inset-0" onClick={() => setIsSearchOpen(false)} />
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#140D22] shadow-2xl overflow-hidden z-50">
            <div className="flex items-center px-4 h-12 border-b border-slate-200 dark:border-white/10">
              <Search className="w-4 h-4 text-[#C8963E] mr-3 shrink-0" strokeWidth={2} />
              <input 
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none! shadow-none! p-0! h-auto! outline-none text-[14px] text-slate-900 dark:text-white placeholder:text-slate-400"
                placeholder="Search catalog books, barcodes, authors, or commands..."
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="mr-2 text-slate-400 hover:text-slate-900 dark:hover:text-white text-[12px] cursor-pointer"
                >
                  Clear
                </button>
              )}
              <kbd 
                onClick={() => setIsSearchOpen(false)}
                className="inline-flex items-center justify-center h-5 px-1.5 text-[12px] font-mono rounded cursor-pointer border border-slate-300 dark:border-white/15 text-slate-500 bg-slate-100 dark:bg-white/5"
              >
                ESC
              </kbd>
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="ml-3 p-1 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 max-h-[60vh] overflow-y-auto flex flex-col gap-1">
              {(() => {
                const q = searchQuery.toLowerCase().trim();
                const allNav = navGroups.flatMap(g => g.items).filter(item => item.id !== 'search');
                const matchingNav = !q ? allNav : allNav.filter(item => item.title.toLowerCase().includes(q));
                
                // Null-safe search matching
                const matchingBooks = !q ? [] : catalogBooks.filter(b => 
                  (b.book_name || '').toLowerCase().includes(q) || 
                  (b.barcode || '').toLowerCase().includes(q) ||
                  (b.author || '').toLowerCase().includes(q) ||
                  (b.category || '').toLowerCase().includes(q)
                ).slice(0, 8);

                return (
                  <>
                    <div className="text-[11px] uppercase font-bold tracking-wider px-2 py-1 text-slate-400">
                      Quick Navigation
                    </div>
                    {matchingNav.map(item => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            onTabChange(item.id as NavigationTab);
                            setIsSearchOpen(false);
                          }}
                          className="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-[14px] text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 text-[#C8963E]" />
                            <span>{item.title}</span>
                          </div>
                          {item.shortcut && (
                            <kbd className="text-[12px] font-mono px-1.5 py-0.5 rounded border border-slate-300 dark:border-white/15 text-slate-400 bg-slate-100 dark:bg-white/5">
                              {item.shortcut}
                            </kbd>
                          )}
                        </div>
                      );
                    })}

                    {matchingBooks.length > 0 && (
                      <div className="flex flex-col gap-1 pt-2 border-t border-slate-200 dark:border-white/10 mt-1">
                        <div className="text-[11px] uppercase font-bold tracking-wider text-[#C8963E] px-2 py-0.5">
                          Catalog Books ({matchingBooks.length})
                        </div>
                        {matchingBooks.map(book => (
                          <div
                            key={book.id || book.barcode}
                            onClick={() => {
                              if (onSelectBook) {
                                onSelectBook(book);
                              } else {
                                onTabChange('catalog');
                              }
                              setIsSearchOpen(false);
                            }}
                            className="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border border-transparent hover:border-[#C8963E]/40 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-[14px] font-semibold truncate">
                                {book.book_name}
                              </div>
                              <div className="text-[12px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>{book.author || 'Unknown Author'}</span>
                                <span>•</span>
                                <span className="font-mono text-[#C8963E] font-semibold">{book.barcode}</span>
                                <span>•</span>
                                <span>{book.category || 'General'}</span>
                              </div>
                            </div>
                            <span className="shrink-0 text-[11px] font-mono px-2 py-0.5 rounded border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300">
                              {book.available_quantity ?? 1}/{book.total_quantity ?? 1} Avail
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {matchingNav.length === 0 && matchingBooks.length === 0 && (
                      <div className="py-8 text-center text-slate-400 text-[14px]">
                        No matches found for <span className="text-[#C8963E] font-mono">"{searchQuery}"</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="px-4 h-10 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-[12px] text-slate-400 bg-slate-50 dark:bg-[#0B0814]">
              <div className="flex items-center gap-2">
                <Command className="w-3.5 h-3.5 text-[#C8963E]" />
                <span>Tip: Press <strong>⌘1</strong> - <strong>⌘6</strong> or <strong>⌘A</strong> for instant tab switches</span>
              </div>
              <span className="font-mono text-[11px] font-bold text-slate-500">ULM LMS</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const LmsSidebar = Sidebar;
export default Sidebar;
