import React, { useState, useEffect, useCallback, useRef } from "react";
import { BoardItem, Column, Tag, Assignee, ItemType, Priority, ActivityLog } from "./types";
import { 
  INITIAL_COLUMNS, 
  INITIAL_TAGS, 
  INITIAL_ASSIGNEES, 
  INITIAL_ITEMS 
} from "./data";
import Board from "./components/Board";
import StatsView from "./components/StatsView";
import SettingsView from "./components/SettingsView";
import ItemModal from "./components/ItemModal";
import { 
  Layers, 
  TrendingUp, 
  Settings, 
  Plus, 
  Search, 
  Zap, 
  SlidersHorizontal,
  XCircle,
  Database,
  Terminal,
  AlertOctagon,
  Flame,
  Bug,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Inbox,
  Filter,
  RefreshCw,
  CheckCircle2,
  WifiOff
} from "lucide-react";

// REST API client (SQLite backend)
import * as api from "./api";

// Current simulated user
const CURRENT_USER = "Alam Tanvir";

export default function App() {
  // --- Persistent Workspace States ---
  const [items, setItems] = useState<BoardItem[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);

  // API / server connectivity
  const [isServerOnline, setIsServerOnline] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Active View Tab: 'board' | 'stats' | 'settings'
  const [activeTab, setActiveTab] = useState<"board" | "stats" | "settings">("board");

  // --- Filtering States ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");

  // --- Modal Management States ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<BoardItem | undefined>(undefined);
  const [defaultColumnForNewItem, setDefaultColumnForNewItem] = useState<string>("todo");

  // --- Load all data from the REST API ---
  const fetchAllData = useCallback(async () => {
    try {
      const healthy = await api.checkHealth();
      if (!healthy) throw new Error("Server offline");
      setIsServerOnline(true);

      const [fetchedItems, fetchedColumns, fetchedTags, fetchedAssignees] = await Promise.all([
        api.getItems(),
        api.getColumns(),
        api.getTags(),
        api.getAssignees(),
      ]);

      setItems(fetchedItems);
      setColumns(fetchedColumns.length > 0 ? fetchedColumns : INITIAL_COLUMNS);
      setTags(fetchedTags.length > 0 ? fetchedTags : INITIAL_TAGS);
      setAssignees(fetchedAssignees.length > 0 ? fetchedAssignees : INITIAL_ASSIGNEES);

      // Mirror to localStorage as offline cache
      localStorage.setItem("dev_board_items", JSON.stringify(fetchedItems));
      localStorage.setItem("dev_board_columns", JSON.stringify(fetchedColumns));
      localStorage.setItem("dev_board_tags", JSON.stringify(fetchedTags));
      localStorage.setItem("dev_board_assignees", JSON.stringify(fetchedAssignees));
    } catch {
      setIsServerOnline(false);
      // Load from localStorage cache when server is unreachable
      try {
        const si = localStorage.getItem("dev_board_items");
        const sc = localStorage.getItem("dev_board_columns");
        const st = localStorage.getItem("dev_board_tags");
        const sa = localStorage.getItem("dev_board_assignees");
        if (si) setItems(JSON.parse(si)); else setItems(INITIAL_ITEMS);
        if (sc) setColumns(JSON.parse(sc)); else setColumns(INITIAL_COLUMNS);
        if (st) setTags(JSON.parse(st)); else setTags(INITIAL_TAGS);
        if (sa) setAssignees(JSON.parse(sa)); else setAssignees(INITIAL_ASSIGNEES);
      } catch {
        setItems(INITIAL_ITEMS);
        setColumns(INITIAL_COLUMNS);
        setTags(INITIAL_TAGS);
        setAssignees(INITIAL_ASSIGNEES);
      }
    }
  }, []);

  // Initial load + 15-second polling for live sync across tabs
  useEffect(() => {
    fetchAllData();
    pollRef.current = setInterval(fetchAllData, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAllData]);

  // --- Ticket Operations ---
  
  // Handler: Save ticket details (Add or update existing)
  const handleSaveItem = async (savedItem: BoardItem) => {
    try {
      await api.saveItem(savedItem);
      await fetchAllData();
    } catch {
      // Offline fallback — update local state
      setItems((prevItems) => {
        const exists = prevItems.some((item) => item.id === savedItem.id);
        if (exists) return prevItems.map((item) => (item.id === savedItem.id ? savedItem : item));
        return [savedItem, ...prevItems];
      });
    }
    setIsModalOpen(false);
    setActiveItem(undefined);
  };

  // Handler: Move ticket column (with auto auditing log item)
  const handleMoveItem = async (id: string, newStatus: string) => {
    const target = items.find(i => i.id === id);
    if (!target) return;
    if (target.status === newStatus) return;

    const oldColTitle = columns.find(c => c.id === target.status)?.title || target.status;
    const newColTitle = columns.find(c => c.id === newStatus)?.title || newStatus;

    const movementLog: ActivityLog = {
      id: `move-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: CURRENT_USER,
      action: `Relocated ticket from "${oldColTitle}" into column "${newColTitle}"`,
    };

    const updatedItem = { ...target, status: newStatus, history: [movementLog, ...target.history] };

    // Optimistic UI update first
    setItems((prev) => prev.map((item) => (item.id === id ? updatedItem : item)));

    try {
      await api.saveItem(updatedItem);
    } catch {
      console.warn("Move not synced to server — offline mode");
    }
  };

  // Handler: Delete ticket
  const handleDeleteItem = async (id: string) => {
    // Optimistic UI update
    setItems((prevItems) => prevItems.filter((i) => i.id !== id));
    try {
      await api.deleteItem(id);
    } catch {
      console.warn("Delete not synced to server — offline mode");
    }
    setIsModalOpen(false);
    setActiveItem(undefined);
  };

  // Handler: Add new ticket (opens modal setup)
  const handleAddItemFromColumn = (columnId: string) => {
    setDefaultColumnForNewItem(columnId);
    setActiveItem(undefined);
    setIsModalOpen(true);
  };

  // Synchronize Settings updates with the REST API
  const handleUpdateTags = async (nextTags: Tag[]) => {
    const deleted = tags.filter((t) => !nextTags.some((nt) => nt.id === t.id));
    setTags(nextTags);
    try {
      for (const t of deleted) await api.deleteTag(t.id).catch(() => {});
      for (const t of nextTags) await api.saveTag(t).catch(() => {});
    } catch { console.warn("Tag sync failed — offline mode"); }
  };

  const handleUpdateAssignees = async (nextAssignees: Assignee[]) => {
    const deleted = assignees.filter((a) => !nextAssignees.some((na) => na.id === a.id));
    setAssignees(nextAssignees);
    try {
      for (const a of deleted) await api.deleteAssignee(a.id).catch(() => {});
      for (const a of nextAssignees) await api.saveAssignee(a).catch(() => {});
    } catch { console.warn("Assignee sync failed — offline mode"); }
  };

  const handleUpdateColumns = async (nextColumns: Column[]) => {
    const deleted = columns.filter((c) => !nextColumns.some((nc) => nc.id === c.id));
    setColumns(nextColumns);
    try {
      for (const c of deleted) await api.deleteColumn(c.id).catch(() => {});
      for (const c of nextColumns) await api.saveColumn(c).catch(() => {});
    } catch { console.warn("Column sync failed — offline mode"); }
  };

  // Handler: Reset Board to Baseline standard parameters
  const handleResetWorkspace = async () => {
    // Optimistic local reset
    setItems(INITIAL_ITEMS);
    setColumns(INITIAL_COLUMNS);
    setTags(INITIAL_TAGS);
    setAssignees(INITIAL_ASSIGNEES);

    try {
      // Clear server-side data and re-seed
      for (const item of items) await api.deleteItem(item.id).catch(() => {});
      for (const col of columns) await api.deleteColumn(col.id).catch(() => {});
      for (const t of tags) await api.deleteTag(t.id).catch(() => {});
      for (const a of assignees) await api.deleteAssignee(a.id).catch(() => {});

      for (const col of INITIAL_COLUMNS) await api.saveColumn(col).catch(() => {});
      for (const t of INITIAL_TAGS) await api.saveTag(t).catch(() => {});
      for (const a of INITIAL_ASSIGNEES) await api.saveAssignee(a).catch(() => {});
      for (const item of INITIAL_ITEMS) await api.saveItem(item).catch(() => {});
    } catch {
      console.warn("Reset sync failed — server may be offline");
    }

    // Persist to cache
    localStorage.setItem("dev_board_items", JSON.stringify(INITIAL_ITEMS));
    localStorage.setItem("dev_board_columns", JSON.stringify(INITIAL_COLUMNS));
    localStorage.setItem("dev_board_tags", JSON.stringify(INITIAL_TAGS));
    localStorage.setItem("dev_board_assignees", JSON.stringify(INITIAL_ASSIGNEES));

    handleClearFilters();
  };

  // Handler: Select a filter metric segment inside analytics (auto routes to Board view)
  const handleSelectFilterFromStats = (filterType: "type" | "priority" | "status" | "assignee", value: string) => {
    if (filterType === "type") setSelectedType(value);
    if (filterType === "priority") setSelectedPriority(value);
    if (filterType === "status") {
      // Clear status filters, since columns are persistent visible on board
    }
    if (filterType === "assignee") setSelectedAssignee(value);
    
    // Shift tab back to board
    setActiveTab("board");
  };

  // Helper Clear Filters
  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedType("");
    setSelectedPriority("");
    setSelectedTag("");
    setSelectedAssignee("");
  };

  // --- EXCEPTION HOOK SIMULATORS (For high realism!) ---
  const handleSimulateErrorAlert = (category: "redis_crash" | "qa_regression" | "api_500") => {
    const errorList = {
      redis_crash: {
        title: "CRITICAL: Redis Memory Out of Pool Allocations on Cache-02",
        description: "Automated alert pipeline: Redis master cluster returned standard OOM rejection payloads on concurrent fetch session items. View dump allocations for detail checks.",
        type: ItemType.ERROR,
        priority: Priority.URGENT,
        assigneeId: "alam",
        tags: ["back", "perf"],
      },
      qa_regression: {
        title: "REGRESSION: Checkout Button Disabled in Firefox Mobile Client",
        description: "QA automated testing client: Firefox agent 7.2 reporting tap response blocker on primary submit button in mobile landscape viewports.",
        type: ItemType.BUG,
        priority: Priority.HIGH,
        assigneeId: "jane",
        tags: ["front", "qa"],
      },
      api_500: {
        title: "EXCEPTION: 504 Gateway Timeout on microservice /api/v2/pricing",
        description: "Server exception payload: Target pricing router took more than 15000ms resolving localized conversion assets on concurrent sessions.",
        type: ItemType.ERROR,
        priority: Priority.HIGH,
        assigneeId: "john",
        tags: ["api", "back"],
      }
    };

    const chosen = errorList[category];
    
    const newAlert: BoardItem = {
      id: `sim-err-${Date.now()}`,
      title: chosen.title,
      description: chosen.description,
      type: chosen.type,
      priority: chosen.priority,
      status: "backlog",
      assigneeId: chosen.assigneeId,
      dueDate: new Date(Date.now() + 864500 * 1000 * 3).toISOString().split("T")[0], // 3 days details
      tags: chosen.tags,
      subtasks: [
        { id: `sim-sub-1`, title: "Inspect telemetry stacktrace logs in dashboard", completed: false },
        { id: `sim-sub-2`, title: "Verify connection leak thresholds", completed: false }
      ],
      history: [
        { 
          id: `sim-h-1`, 
          timestamp: new Date().toISOString(), 
          user: "Sentry Hook Service", 
          action: "Automated exception caught on production deployment server cluster and pushed to team Backlog Queue." 
        }
      ],
      createdDate: new Date().toISOString()
    };

    setItems((prev) => [newAlert, ...prev]);
    
    // Jump to board view to see it pop!
    setActiveTab("board");
  };

  // Is active filters checked indicator
  const hasActiveFilters = searchQuery !== "" || selectedType !== "" || selectedPriority !== "" || selectedTag !== "" || selectedAssignee !== "";

  return (
    <div id="devflow-root" className="min-h-screen bg-slate-50/50 flex flex-col font-sans text-slate-900 antialiased select-none">
      
      {/* Upper Unified Premium Header - Minimalist styling with responsive micro items */}
      <header className="bg-slate-900 text-white border-b border-slate-800/10 shadow-xs backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-600 border-0 rounded-xl flex items-center justify-center font-black text-xl text-white shadow-sm">
              <Terminal className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-medium text-sm tracking-wider text-white">DEVFLOW</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="System Status: Connected Live Sync" />
              </div>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                {isServerOnline ? "SQLITE REST API — LIVE" : "OFFLINE CACHE MODE"}
              </p>
            </div>
          </div>

          {/* Quick Stats Summary Pills */}
          <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-slate-300">
            <div className="flex items-center gap-1.5 bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-800/40">
              <span className="text-slate-400 font-bold uppercase tracking-widest">TICKETS:</span>
              <span className="font-bold text-white text-xs">{items.length}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-800/40">
              <span className="text-rose-450 text-rose-300 font-bold uppercase tracking-widest">BUGS:</span>
              <span className="font-bold text-rose-300 text-xs">{items.filter(i => i.type === ItemType.BUG).length}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-800/40">
              <span className="text-red-450 text-red-300 font-bold uppercase tracking-widest">CRASHES:</span>
              <span className="font-bold text-red-300 text-xs">{items.filter(i => i.type === ItemType.ERROR).length}</span>
            </div>
          </div>

          {/* Connected User Badge */}
          <div className="flex items-center gap-2.5 font-sans">
            <div className="text-right hidden sm:block">
              <span className="text-[9px] text-indigo-400 block font-mono uppercase tracking-wider">AUTHORIZED DEV</span>
              <span className="text-xs font-semibold text-slate-200 block tracking-tight">{CURRENT_USER}</span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center uppercase shadow-sm">
              AT
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        
        {/* Navigation Action combined block */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-100 p-4 rounded-2xl shadow-xs">
          
          {/* Active Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-100/60 p-1 rounded-xl w-full sm:w-auto">
            <button
              id="tab-board"
              onClick={() => setActiveTab("board")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-1.5 text-[11px] font-display uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                activeTab === "board" 
                  ? "bg-slate-950 text-white font-bold" 
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Kanban Board
            </button>
            <button
              id="tab-stats"
              onClick={() => setActiveTab("stats")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-1.5 text-[11px] font-display uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                activeTab === "stats" 
                  ? "bg-slate-950 text-white font-bold" 
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Telemetry Stats
            </button>
            <button
              id="tab-settings"
              onClick={() => setActiveTab("settings")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-1.5 text-[11px] font-display uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                activeTab === "settings" 
                  ? "bg-slate-955 bg-slate-950 text-white font-bold" 
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Workspace Setup
            </button>
          </div>

          {/* Quick Addition & Alerts Options */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Auto Ingest Error Dropdown */}
            <div className="relative group shrink-0">
              <button
                id="btn-trigger-exception"
                className="px-3.5 py-2.5 bg-white hover:bg-slate-50/60 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Zap className="w-3.5 h-3.5 text-indigo-505" />
                Trigger Crash Hook
              </button>
              
              {/* Dropdown Options List */}
              <div className="absolute right-0 mt-1.5 w-56 bg-white border border-slate-100 rounded-xl shadow-md p-2 hidden group-hover:block hover:block z-20">
                <p className="text-[10px] text-slate-400 font-mono p-2 border-b border-slate-100">SIMULATE REAL EXCEPTION</p>
                <button 
                  onClick={() => handleSimulateErrorAlert("redis_crash")}
                  className="w-full text-left p-2 hover:bg-rose-50 text-xs font-medium text-slate-700 rounded-lg flex items-center gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5 text-rose-500" />
                  Redis Cache OOM Crash
                </button>
                <button 
                  onClick={() => handleSimulateErrorAlert("api_500")}
                  className="w-full text-left p-2 hover:bg-amber-50 text-xs font-medium text-slate-700 rounded-lg flex items-center gap-1.5"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-amber-500" />
                  API 504 Pricing Gateway
                </button>
                <button 
                  onClick={() => handleSimulateErrorAlert("qa_regression")}
                  className="w-full text-left p-2 hover:bg-sky-50 text-xs font-medium text-slate-700 rounded-lg flex items-center gap-1.5"
                >
                  <Bug className="w-3.5 h-3.5 text-sky-500" />
                  Firefox Touch Regression
                </button>
              </div>
            </div>

            <button
              id="btn-global-add-ticket"
              onClick={() => {
                setActiveItem(undefined);
                setDefaultColumnForNewItem("backlog");
                setIsModalOpen(true);
              }}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm border-0"
            >
              <Plus className="w-4 h-4" />
              Add Ticket
            </button>
          </div>

        </div>

        {/* Board Search and Filtering Utility Bar */}
        {activeTab === "board" && (
          <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs flex flex-col gap-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              
              {/* Search Element input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="global-search-query"
                  type="text"
                  placeholder="Query ticket name, description guideline, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50/60 border border-slate-200 text-xs rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-indigo-400 focus:bg-white transition-all text-slate-600 placeholder-slate-400/60 shadow-xs"
                />
              </div>

              {/* Filtering Controls options dropdown group */}
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Type Filter */}
                <select
                  title="Filter type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-slate-50/60 border border-slate-200 text-xs text-slate-600 rounded-xl p-2.5 outline-none focus:border-indigo-405 focus:bg-white cursor-pointer shadow-xs"
                >
                  <option value="">All Issue Types</option>
                  <option value={ItemType.TASK}>Task</option>
                  <option value={ItemType.BUG}>Bug</option>
                  <option value={ItemType.ERROR}>Error</option>
                  <option value={ItemType.FEATURE}>Feature Request</option>
                </select>

                {/* Priority Filter */}
                <select
                  title="Filter priority"
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="bg-slate-50/60 border border-slate-200 text-xs text-slate-600 rounded-xl p-2.5 outline-none focus:border-indigo-405 focus:bg-white cursor-pointer shadow-xs"
                >
                  <option value="">All Priorities</option>
                  <option value={Priority.URGENT}>Urgent</option>
                  <option value={Priority.HIGH}>High</option>
                  <option value={Priority.MEDIUM}>Medium</option>
                  <option value={Priority.LOW}>Low</option>
                </select>

                {/* Assignee Filter */}
                <select
                  title="Filter assignee"
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className="bg-slate-50/60 border border-slate-200 text-xs text-slate-600 rounded-xl p-2.5 outline-none focus:border-indigo-405 focus:bg-white cursor-pointer shadow-xs"
                >
                  <option value="">All Teammates</option>
                  {assignees.map((as) => (
                    <option key={as.id} value={as.id}>{as.name}</option>
                  ))}
                </select>

                {/* Clear triggers */}
                {hasActiveFilters && (
                  <button
                    id="btn-clear-filters"
                    onClick={handleClearFilters}
                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold border border-transparent rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reset Filters
                  </button>
                )}

              </div>
            </div>

            {/* Quick Tag Filtering Toggles Row */}
            <div className="flex items-center gap-2 border-t border-slate-50 pt-3 overflow-x-auto select-none no-scrollbar">
              <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider flex items-center gap-shrink-0">
                <Filter className="w-3 h-3 text-slate-400 mr-1" />
                TAG CLASSIFICATION:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedTag("")}
                  className={`px-3 py-1 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    selectedTag === "" 
                      ? "bg-slate-900 text-white shadow-xs" 
                      : "bg-slate-50/60 text-slate-500 border border-slate-100 hover:border-slate-200 hover:bg-white transition-all font-semibold"
                  }`}
                >
                  ALL
                </button>
                {tags.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setSelectedTag(selectedTag === t.id ? "" : t.id)}
                    className={`px-2.5 py-1 text-[10px] uppercase border transition-all cursor-pointer font-bold ${
                      selectedTag === t.id 
                        ? `${t.bgClass} border-transparent shadow-xs font-bold rounded-xl` 
                        : "bg-slate-50/60 text-slate-450 text-slate-400 border border-slate-100 hover:border-slate-200 hover:bg-white rounded-xl transition-all font-semibold"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            
          </div>
        )}

        {/* View Layout Renderer */}
        <div id="workspace-renderer-viewport" className="flex-1">
          {activeTab === "board" && (
            <Board
              items={items}
              columns={columns}
              tags={tags}
              assignees={assignees}
              onMoveItem={handleMoveItem}
              onEditItem={(id) => {
                const found = items.find((i) => i.id === id);
                if (found) {
                  setActiveItem(found);
                  setIsModalOpen(true);
                }
              }}
              onAddItem={handleAddItemFromColumn}
              searchQuery={searchQuery}
              selectedType={selectedType}
              selectedPriority={selectedPriority}
              selectedTag={selectedTag}
              selectedAssignee={selectedAssignee}
            />
          )}

          {activeTab === "stats" && (
            <StatsView
              items={items}
              columns={columns}
              assignees={assignees}
              onSelectFilter={handleSelectFilterFromStats}
            />
          )}

          {activeTab === "settings" && (
            <SettingsView
              tags={tags}
              assignees={assignees}
              columns={columns}
              onUpdateTags={handleUpdateTags}
              onUpdateAssignees={handleUpdateAssignees}
              onUpdateColumns={handleUpdateColumns}
              onResetBoard={handleResetWorkspace}
            />
          )}
        </div>

      </main>

      {/* Detail Modal Component */}
      {isModalOpen && (
        <ItemModal
          item={activeItem}
          tags={tags}
          assignees={assignees}
          columns={columns.map(c => ({ id: c.id, title: c.title }))}
          onClose={() => {
            setIsModalOpen(false);
            setActiveItem(undefined);
          }}
          onSave={handleSaveItem}
          onDelete={activeItem ? handleDeleteItem : undefined}
          currentUser={CURRENT_USER}
        />
      )}

      {/* Pure Human Footer Credits */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-slate-500 text-xs mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3 font-mono uppercase tracking-wider text-[11px]">
          <p className="leading-tight text-slate-400 font-bold">
            Dev Kanban Board &copy; 2026. Live Operations Database.
          </p>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-slate-400">
              <Database className="w-3.5 h-3.5 text-slate-400 animate-pulse" />
              SQLite — Local Database
            </span>
            <span className="text-slate-200">|</span>
            <span className={`flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl ${
              isServerOnline ? "text-emerald-600" : "text-rose-500"
            }`}>
              {isServerOnline
                ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> API Online</>
                : <><WifiOff className="w-3.5 h-3.5 text-rose-500" /> Offline Cache</>}
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
