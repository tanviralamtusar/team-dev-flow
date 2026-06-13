import React, { useState, useEffect, useCallback, useRef } from "react";
import { BoardItem, Column, Tag, Assignee, ItemType, Priority, ActivityLog, Project, Invitation } from "./types";
import { 
  INITIAL_COLUMNS, 
  INITIAL_TAGS, 
  INITIAL_ASSIGNEES, 
  INITIAL_ITEMS 
} from "./data";
import Board from "./components/Board";
import StatsView from "./components/StatsView";
import TeammatesView from "./components/TeammatesView";
import SettingsView from "./components/SettingsView";
import ItemModal from "./components/ItemModal";
import Auth from "./components/Auth";
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
  WifiOff,
  Moon,
  Sun,
  LogOut,
  User as UserIcon,
  Loader2,
  FolderKanban,
  Bell,
  ChevronDown,
  Check,
  X,
  Users
} from "lucide-react";

// REST API client (SQLite backend)
import * as api from "./api";

export default function App() {
  // --- Auth State ---
  const [user, setUser] = useState<any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // --- Project & Team States ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isProjectsDropdownOpen, setIsProjectsDropdownOpen] = useState(false);
  const [isInvitationsOpen, setIsInvitationsOpen] = useState(false);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(1);

  // --- Persistent Workspace States ---
  const [items, setItems] = useState<BoardItem[]>(INITIAL_ITEMS);
  const [columns, setColumns] = useState<Column[]>(INITIAL_COLUMNS);
  const [tags, setTags] = useState<Tag[]>(INITIAL_TAGS);
  const [assignees, setAssignees] = useState<Assignee[]>(INITIAL_ASSIGNEES);

  // --- Auth & Project Check ---
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        setIsAuthChecking(false);
        return;
      }
      try {
        const u = await api.getCurrentUser();
        setUser(u);
        
        // Fetch projects
        const fetchedProjects = await api.getProjects();
        setProjects(fetchedProjects);
        
        // Restore active project or set first one
        const savedProjectId = localStorage.getItem("current_project_id");
        const restored = fetchedProjects.find(p => p.id === savedProjectId);
        if (restored) {
          setActiveProject(restored);
          api.setProjectId(restored.id);
        } else if (fetchedProjects.length > 0) {
          setActiveProject(fetchedProjects[0]);
          api.setProjectId(fetchedProjects[0].id);
        }

        // Fetch invitations
        const fetchedInvs = await api.getInvitations();
        setInvitations(fetchedInvs);
      } catch {
        api.setToken(null);
        setUser(null);
      } finally {
        setIsAuthChecking(false);
      }
    };
    checkAuth();
  }, []);

  const handleAuthenticated = async (u: any) => {
    setUser(u);
    try {
      const fetchedProjects = await api.getProjects();
      setProjects(fetchedProjects);

      const savedProjectId = localStorage.getItem("current_project_id");
      const restored = fetchedProjects.find(p => p.id === savedProjectId);
      if (restored) {
        setActiveProject(restored);
        api.setProjectId(restored.id);
      } else if (fetchedProjects.length > 0) {
        setActiveProject(fetchedProjects[0]);
        api.setProjectId(fetchedProjects[0].id);
      }

      const fetchedInvs = await api.getInvitations();
      setInvitations(fetchedInvs);
    } catch {
      // Projects/invitations fetch failed — user is still logged in
    }
  };

  const handleLogout = () => {
    api.setToken(null);
    api.setProjectId(null);
    setUser(null);
    setActiveProject(null);
    setProjects([]);
  };

  const handleSwitchProject = (project: Project) => {
    setActiveProject(project);
    api.setProjectId(project.id);
    setIsProjectsDropdownOpen(false);
    // Trigger data reload
    fetchAllData();
  };

  const handleCreateProject = async () => {
    const name = prompt("Enter project name:");
    if (!name) return;
    try {
      const newProj = await api.createProject(name);
      setProjects(prev => [...prev, newProj]);
      handleSwitchProject(newProj);
      
      // Seed the new project with initial data
      await Promise.all([
        ...INITIAL_COLUMNS.map(c => api.saveColumn(c)),
        ...INITIAL_TAGS.map(t => api.saveTag(t)),
        ...INITIAL_ASSIGNEES.map(a => api.saveAssignee(a)),
      ]);
      fetchAllData();
    } catch (err) {
      alert("Failed to create project");
    }
  };

  const handleAcceptInvitation = async (inv: Invitation) => {
    try {
      await api.acceptInvitation(inv.id);
      setInvitations(prev => prev.filter(i => i.id !== inv.id));
      const fetchedProjects = await api.getProjects();
      setProjects(fetchedProjects);
      if (!activeProject && fetchedProjects.length > 0) {
        handleSwitchProject(fetchedProjects[0]);
      }
    } catch (err) {
      alert("Failed to accept invitation");
    }
  };

  const handleDeclineInvitation = async (inv: Invitation) => {
    try {
      await api.declineInvitation(inv.id);
      setInvitations(prev => prev.filter(i => i.id !== inv.id));
    } catch (err) {
      alert("Failed to decline invitation");
    }
  };

  // --- Theme Management ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("dev_board_theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("dev_board_theme")) {
        setIsDarkMode(e.matches);
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Update theme on manual change
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const newVal = !prev;
      localStorage.setItem("dev_board_theme", newVal ? "dark" : "light");
      return newVal;
    });
  };

  // API / server connectivity
  const [isServerOnline, setIsServerOnline] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Active View Tab: 'board' | 'stats' | 'teammates' | 'settings'
  const [activeTab, setActiveTab] = useState<"board" | "stats" | "teammates" | "settings">("board");

  // --- Filtering States ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");

  // --- Modal Management States ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalReadOnly, setIsModalReadOnly] = useState(false);
  const [activeItem, setActiveItem] = useState<BoardItem | undefined>(undefined);
  const [defaultColumnForNewItem, setDefaultColumnForNewItem] = useState<string>("todo");

  // --- Load all data from the REST API ---
  const fetchAllData = useCallback(async () => {
    if (!user || !activeProject) return;
      try {
        const healthy = await api.checkHealth();
        if (!healthy) throw new Error("Server offline");
        setIsServerOnline(true);

        const [fetchedItems, fetchedColumns, fetchedTags, fetchedAssignees, heartbeat, fetchedProjects] = await Promise.all([
          api.getItems(),
          api.getColumns(),
          api.getTags(),
          api.getAssignees(),
          api.sendHeartbeat(activeProject.id),
          api.getProjects()
        ]);

        setItems(fetchedItems);
        setColumns(fetchedColumns.length > 0 ? fetchedColumns : INITIAL_COLUMNS);
        setTags(fetchedTags.length > 0 ? fetchedTags : INITIAL_TAGS);
        setAssignees(fetchedAssignees.length > 0 ? fetchedAssignees : INITIAL_ASSIGNEES);
        setActiveUsersCount(heartbeat.activeCount);
        setProjects(fetchedProjects);

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
  }, [user, activeProject]);

  // Initial load + 15-second polling for live sync across tabs
  useEffect(() => {
    if (!user || !activeProject) return;
    fetchAllData();
    pollRef.current = setInterval(fetchAllData, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAllData, user, activeProject]);

  // --- Ticket Operations ---
  
  // Handler: Save ticket details (Add or update existing)
  const handleSaveItem = async (savedItem: BoardItem) => {
    // Optimistic UI update
    const isNew = !items.some(i => i.id === savedItem.id);
    setItems((prevItems) => {
      if (isNew) return [savedItem, ...prevItems];
      return prevItems.map((item) => (item.id === savedItem.id ? savedItem : item));
    });

    try {
      if (isNew) {
        await api.saveItem(savedItem);
      } else {
        await api.updateItem(savedItem.id, savedItem);
      }
      await fetchAllData();
    } catch (err) {
      console.error("Failed to save ticket to server:", err);
      setIsServerOnline(false);
      // Data remains in local state (optimistically updated above)
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
      user: user?.username || "Unknown",
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
    setIsModalReadOnly(false);
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
    setAssignees(nextAssignees);
    try {
      await api.updateAssignees(nextAssignees);
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

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0b0f1a]">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div id="devflow-root" className="min-h-screen bg-white dark:bg-[#0b0f1a] flex flex-col font-sans text-slate-900 dark:text-slate-100 antialiased select-none">
      
      {/* Upper Unified Premium Header - Minimalist styling with responsive micro items */}
      <header className="bg-white dark:bg-[#080c14] text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800/50 shadow-xs backdrop-blur-md sticky top-0 z-40">
        <div className="px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
            <div className="w-8 h-8 md:w-9 md:h-9 bg-indigo-600 border-0 rounded-xl flex items-center justify-center font-black text-xl text-white shadow-sm shrink-0">
              <Terminal className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
            </div>
            <div className="relative flex flex-col min-w-0">
              <button 
                onClick={() => setIsProjectsDropdownOpen(!isProjectsDropdownOpen)}
                className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-all text-left min-w-0"
              >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-display font-bold text-xs md:text-sm tracking-wider text-slate-900 dark:text-white uppercase truncate">{activeProject?.name || "No Project"}</span>
                      <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                    <p className="text-[8px] md:text-[10px] text-slate-400 font-mono uppercase tracking-wider truncate">
                      {isServerOnline ? "SQLITE — LIVE" : "OFFLINE"}
                    </p>
                </div>
              </button>
              
              {isProjectsDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-2 animate-in fade-in slide-in-from-top-1">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono px-3 py-2 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800/50 mb-1">Your Workspaces</p>
                    <div className="max-h-[300px] overflow-y-auto">
                      {projects.map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleSwitchProject(p)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all mb-1 ${
                            activeProject?.id === p.id 
                              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold" 
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="truncate">{p.name}</span>
                            {(p.activeCount ?? 0) > 0 && (
                              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[9px] text-slate-500 shrink-0">
                                <Users className="w-2.5 h-2.5" />
                                <span>{p.activeCount}</span>
                              </div>
                            )}
                          </div>
                          {activeProject?.id === p.id && <Check className="w-4 h-4 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  <div className="pt-2 border-t border-slate-50 dark:border-slate-800/50 mt-1">
                    <button
                      onClick={handleCreateProject}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all font-semibold"
                    >
                      <Plus className="w-4 h-4" />
                      Create New Project
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats Summary Pills */}
          <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-slate-300">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800/40">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">TICKETS:</span>
              <span className="font-bold text-slate-900 dark:text-white text-xs">{items.length}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800/40">
              <span className="text-rose-600 dark:text-rose-300 font-bold uppercase tracking-widest">BUGS:</span>
              <span className="font-bold text-rose-600 dark:text-rose-300 text-xs">{items.filter(i => i.type === ItemType.BUG).length}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800/40">
              <span className="text-red-600 dark:text-red-300 font-bold uppercase tracking-widest">CRASHES:</span>
              <span className="font-bold text-red-600 dark:text-red-300 text-xs">{items.filter(i => i.type === ItemType.ERROR).length}</span>
            </div>
          </div>

          {/* Connected User Badge */}
          <div className="flex items-center gap-1.5 md:gap-4 font-sans">
            {/* Invitations Notification */}
            <div className="relative">
              <button
                onClick={() => setIsInvitationsOpen(!isInvitationsOpen)}
                className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-all cursor-pointer relative ${isInvitationsOpen ? "text-indigo-600 dark:text-white bg-slate-200 dark:bg-slate-700/50" : ""}`}
                title="Invitations"
              >
                <Bell className="w-4 h-4 md:w-5 md:h-5" />
                {invitations.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 md:w-4 md:h-4 bg-amber-500 text-white text-[8px] md:text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-bounce">
                    {invitations.length}
                  </span>
                )}
              </button>

              {isInvitationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-3 animate-in fade-in slide-in-from-top-1">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono px-2 py-1 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800/50 mb-3">Project Invitations</p>
                  
                  {invitations.length === 0 ? (
                    <div className="text-center py-6">
                      <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">No pending invitations</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {invitations.map(inv => (
                        <div key={inv.id} className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800">
                          <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">{inv.projectName}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3">Invited by <span className="text-indigo-500 font-semibold">{inv.inviterName}</span></p>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleAcceptInvitation(inv)}
                              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-all"
                            >
                              Accept
                            </button>
                            <button 
                              onClick={() => handleDeclineInvitation(inv)}
                              className="flex-1 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-lg transition-all"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={toggleDarkMode}
              className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-all cursor-pointer"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-4 h-4 md:w-5 md:h-5" /> : <Moon className="w-4 h-4 md:w-5 md:h-5" />}
            </button>
            <div className="flex items-center gap-1 md:gap-2.5">
              <div className="text-right hidden sm:block">
                <span className="text-[9px] text-indigo-400 dark:text-indigo-400 block font-mono uppercase tracking-wider">AUTHORIZED DEV</span>
                <span className="text-xs font-semibold text-white dark:text-slate-200 block tracking-tight">{user?.username}</span>
              </div>
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center uppercase shadow-sm shrink-0">
                {user?.username?.substring(0, 2).toUpperCase()}
              </div>
              <button
                onClick={handleLogout}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        
        {/* Navigation Action combined block */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-[#262f45] p-3 md:p-4 rounded-2xl shadow-xs">
          
          {/* Active Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-100/60 dark:bg-slate-800/40 p-1 rounded-xl overflow-x-auto no-scrollbar">
            {[
              { id: "board", label: "Board", icon: <Layers className="w-3.5 h-3.5" /> },
              { id: "stats", label: "Stats", icon: <TrendingUp className="w-3.5 h-3.5" /> },
              { id: "teammates", label: "Teammates", icon: <Users className="w-3.5 h-3.5" /> },
              { id: "settings", label: "Setup", icon: <Settings className="w-3.5 h-3.5" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 md:px-4 py-2 text-[10px] md:text-[11px] font-display uppercase tracking-wider rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id 
                    ? "bg-slate-950 dark:bg-indigo-600 text-white font-bold" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-700/40"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Addition & Alerts Options */}
          <div className="flex items-center gap-2">
            {/* Auto Ingest Error Dropdown */}
            <div className="relative group flex-1 md:flex-initial">
              <button
                id="btn-trigger-exception"
                className="w-full px-3 py-2.5 bg-white dark:bg-[#1e293b] hover:bg-slate-50/60 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] md:text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Zap className="w-3 md:w-3.5 h-3 md:h-3.5 text-indigo-500" />
                <span className="whitespace-nowrap">Crash Hook</span>
              </button>
              
              {/* Dropdown Options List */}
              <div className="absolute right-0 bottom-full md:bottom-auto md:top-full mb-2 md:mb-0 md:mt-1.5 w-56 bg-white dark:bg-[#1e293b] border border-slate-100 dark:border-slate-700 rounded-xl shadow-md p-2 hidden group-hover:block hover:block z-20">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono p-2 border-b border-slate-100 dark:border-slate-700">SIMULATE REAL EXCEPTION</p>
                <button 
                  onClick={() => handleSimulateErrorAlert("redis_crash")}
                  className="w-full text-left p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-xs font-medium text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5 text-rose-500" />
                  Redis Cache OOM Crash
                </button>
                <button 
                  onClick={() => handleSimulateErrorAlert("api_500")}
                  className="w-full text-left p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-xs font-medium text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1.5"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-amber-500" />
                  API 504 Pricing Gateway
                </button>
                <button 
                  onClick={() => handleSimulateErrorAlert("qa_regression")}
                  className="w-full text-left p-2 hover:bg-sky-50 dark:hover:bg-sky-900/20 text-xs font-medium text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1.5"
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
            setIsModalReadOnly(false);
            setIsModalOpen(true);
          }}
              className="flex-1 md:flex-initial px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] md:text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm border-0"
            >
              <Plus className="w-3.5 md:w-4 h-3.5 md:h-4" />
              <span className="whitespace-nowrap">Add Ticket</span>
            </button>
          </div>

        </div>

        {/* Board Search and Filtering Utility Bar */}
        {activeTab === "board" && (
          <div className="bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-[#262f45] p-3 md:p-4 rounded-2xl shadow-xs flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              
              {/* Search Element input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="global-search-query"
                  type="text"
                  placeholder="Query ticket, description or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-[#1e293b] transition-all text-slate-600 dark:text-slate-300 placeholder-slate-400/60 shadow-xs"
                />
              </div>

              {/* Filtering Controls options dropdown group */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                
                {/* Type Filter */}
                <select
                  title="Filter type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[10px] md:text-xs text-slate-600 dark:text-slate-300 rounded-xl p-2 md:p-2.5 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-[#1e293b] cursor-pointer shadow-xs"
                >
                  <option value="">All Types</option>
                  <option value={ItemType.TASK}>Task</option>
                  <option value={ItemType.BUG}>Bug</option>
                  <option value={ItemType.ERROR}>Error</option>
                  <option value={ItemType.FEATURE}>Feature</option>
                </select>

                {/* Priority Filter */}
                <select
                  title="Filter priority"
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[10px] md:text-xs text-slate-600 dark:text-slate-300 rounded-xl p-2 md:p-2.5 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-[#1e293b] cursor-pointer shadow-xs"
                >
                  <option value="">All Priority</option>
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
                  className="col-span-2 sm:col-auto bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[10px] md:text-xs text-slate-600 dark:text-slate-300 rounded-xl p-2 md:p-2.5 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-[#1e293b] cursor-pointer shadow-xs"
                >
                  <option value="">All Devs</option>
                  {assignees.map((as) => (
                    <option key={as.id} value={as.id}>{as.name}</option>
                  ))}
                </select>

                {/* Clear triggers */}
                {hasActiveFilters && (
                  <button
                    id="btn-clear-filters"
                    onClick={handleClearFilters}
                    className="col-span-2 sm:col-auto flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] md:text-xs font-semibold border border-transparent rounded-xl transition-all cursor-pointer shadow-xs"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reset
                  </button>
                )}

              </div>
            </div>

            {/* Quick Tag Filtering Toggles Row */}
            <div className="flex items-center gap-2 border-t border-slate-50 dark:border-slate-800/60 pt-3 overflow-x-auto select-none no-scrollbar">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono tracking-wider flex items-center shrink-0">
                <Filter className="w-3 h-3 text-slate-400 mr-1" />
                TAGS:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedTag("")}
                  className={`px-3 py-1 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer shrink-0 ${
                    selectedTag === "" 
                      ? "bg-slate-900 dark:bg-indigo-600 text-white shadow-xs" 
                      : "bg-slate-50/60 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-700 transition-all"
                  }`}
                >
                  ALL
                </button>
                {tags.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setSelectedTag(selectedTag === t.id ? "" : t.id)}
                    className={`px-2.5 py-1 text-[10px] uppercase border transition-all cursor-pointer font-bold rounded-xl shrink-0 ${
                      selectedTag === t.id 
                        ? `${t.bgClass} shadow-xs` 
                        : "bg-white dark:bg-[#1e293b] text-slate-400 border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-700"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
            
          </div>
        )}

        {/* No-project banner */}
        {!activeProject && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <FolderKanban className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">No project selected</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  {invitations.length > 0
                    ? "You have pending invitations — accept one to join a project, or create your own."
                    : "Create a new project or ask a teammate to invite you."}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {invitations.length > 0 && (
                <button
                  onClick={() => setIsInvitationsOpen(true)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5" />
                  View Invitations ({invitations.length})
                </button>
              )}
              <button
                onClick={handleCreateProject}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Project
              </button>
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
                  setIsModalReadOnly(true);
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

          {activeTab === "teammates" && (
            <TeammatesView
              projectId={activeProject?.id || ""}
              assignees={assignees}
              onUpdateAssignees={handleUpdateAssignees}
            />
          )}

          {activeTab === "settings" && (
            <SettingsView
              projectId={activeProject?.id || ""}
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
          defaultColumnId={activeItem ? undefined : defaultColumnForNewItem}
          isReadOnly={isModalReadOnly}
          onEdit={() => setIsModalReadOnly(false)}
          onClose={() => {
            setIsModalOpen(false);
            setActiveItem(undefined);
            setIsModalReadOnly(false);
          }}
          onSave={handleSaveItem}
          onDelete={activeItem ? handleDeleteItem : undefined}
          currentUser={user?.username || "Unknown"}
        />
      )}

      {/* Pure Human Footer Credits */}
      <footer className="bg-white dark:bg-[#080c14] border-t border-slate-100 dark:border-slate-800/50 py-6 text-center text-slate-500 text-xs mt-auto">
        <div className="px-4 flex flex-col sm:flex-row justify-between items-center gap-3 font-mono uppercase tracking-wider text-[11px]">
          <p className="leading-tight text-slate-400 dark:text-slate-500 font-bold">
            Dev Kanban Board &copy; 2026. Live Operations Database.
          </p>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 px-3 py-1.5 rounded-xl text-slate-400">
              <Database className="w-3.5 h-3.5 text-slate-400 animate-pulse" />
              SQLite — Local Database
            </span>
            <span className="text-slate-200 dark:text-slate-700">|</span>
            <span className={`flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 px-3 py-1.5 rounded-xl ${
              isServerOnline ? "text-emerald-600 dark:text-emerald-500" : "text-rose-500 dark:text-rose-400"
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
