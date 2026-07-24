import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Excalidraw, MainMenu, WelcomeScreen, exportToBlob, getSceneVersion, serializeAsJSON } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, BinaryFiles, AppState } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import "@excalidraw/excalidraw/index.css";

import * as api from "../api";
import { Canvas, CanvasMeta } from "../types";
import {
  PenTool,
  Plus,
  Trash2,
  Loader2,
  Check,
  CloudOff,
  RefreshCw,
  Pencil,
  ImageDown,
  Clock,
  FolderKanban,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface CanvasViewProps {
  projectId: string;
  isDarkMode: boolean;
  currentUser: string;
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 1500;
const MIN_SURFACE_HEIGHT = 420;
/** Breathing room between the drawing surface and whatever sits under it. */
const SURFACE_BOTTOM_GAP = 24;

/** Per-user viewport (scroll + zoom) is local preference, not shared scene data. */
const viewportKey = (canvasId: string) => `devflow_canvas_viewport_${canvasId}`;

const readViewport = (canvasId: string): Partial<AppState> => {
  try {
    const raw = localStorage.getItem(viewportKey(canvasId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeViewport = (canvasId: string, appState: AppState) => {
  try {
    localStorage.setItem(
      viewportKey(canvasId),
      JSON.stringify({ scrollX: appState.scrollX, scrollY: appState.scrollY, zoom: appState.zoom })
    );
  } catch {
    // Quota exceeded / private mode — viewport restore is a nicety, not critical.
  }
};

const relativeTime = (iso?: string | null) => {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function CanvasView({ projectId, isDarkMode, currentUser }: CanvasViewProps) {
  const [canvases, setCanvases] = useState<CanvasMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCanvas, setActiveCanvas] = useState<Canvas | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingScene, setIsLoadingScene] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [surfaceHeight, setSurfaceHeight] = useState<number>(MIN_SURFACE_HEIGHT);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Scene version of the last successfully persisted state — guards against the
  // high-frequency onChange stream (it fires on pure pointer/selection moves too).
  const savedVersionRef = useRef<number>(-1);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // ── Loading ────────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    if (!projectId) {
      setCanvases([]);
      setIsLoadingList(false);
      return;
    }
    setIsLoadingList(true);
    try {
      const list = await api.getCanvases();
      setCanvases(list);
      setError(null);
      setActiveId((prev) => (prev && list.some((c) => c.id === prev) ? prev : list[0]?.id ?? null));
    } catch {
      setError("Could not reach the canvas service.");
    } finally {
      setIsLoadingList(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Switching projects invalidates the open board.
  useEffect(() => {
    setActiveId(null);
    setActiveCanvas(null);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    if (!activeId) {
      setActiveCanvas(null);
      return;
    }
    setIsLoadingScene(true);
    api
      .getCanvas(activeId)
      .then((canvas) => {
        if (cancelled) return;
        setActiveCanvas(canvas);
        savedVersionRef.current = getSceneVersion((canvas.scene.elements ?? []) as ExcalidrawElement[]);
        setSaveState("idle");
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to open this canvas.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingScene(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // ── Saving ─────────────────────────────────────────────────────────────────
  const persistScene = useCallback(async () => {
    const excalidrawApi = excalidrawApiRef.current;
    const canvasId = activeIdRef.current;
    if (!excalidrawApi || !canvasId) return;

    const elements = excalidrawApi.getSceneElements();
    const appState = excalidrawApi.getAppState();
    const files = excalidrawApi.getFiles();

    // serializeAsJSON strips deleted elements and transient UI state, producing
    // the same portable payload as a .excalidraw file.
    const scene = JSON.parse(serializeAsJSON(elements, appState, files, "database"));
    const version = getSceneVersion(elements);

    setSaveState("saving");
    try {
      const meta = await api.saveCanvasScene(canvasId, {
        elements: scene.elements ?? [],
        appState: scene.appState ?? {},
        files: scene.files ?? files ?? {},
      });
      savedVersionRef.current = version;
      setSaveState("saved");
      setCanvases((prev) => prev.map((c) => (c.id === meta.id ? { ...c, ...meta } : c)));
    } catch {
      setSaveState("error");
    }
  }, []);

  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, _files: BinaryFiles) => {
      const canvasId = activeIdRef.current;
      if (!canvasId) return;

      writeViewport(canvasId, appState);

      if (getSceneVersion(elements) === savedVersionRef.current) return;

      setSaveState("dirty");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(persistScene, AUTOSAVE_DELAY_MS);
    },
    [persistScene]
  );

  // Flush pending edits when the canvas is swapped out or the view unmounts.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        persistScene();
      }
    };
  }, [activeId, persistScene]);

  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        persistScene();
      }
    };
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, [persistScene]);

  // ── Sizing ─────────────────────────────────────────────────────────────────
  // Excalidraw needs a definite pixel height. Rather than hard-coding an offset
  // for the header/nav/footer chrome, measure where the surface actually starts
  // and stretch it to the footer — that stays correct if the chrome changes.
  useLayoutEffect(() => {
    const measure = () => {
      const el = surfaceRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const footerHeight = isExpanded
        ? 0
        : document.querySelector("#devflow-root > footer")?.getBoundingClientRect().height ?? 0;
      const available = window.innerHeight - top - footerHeight - SURFACE_BOTTOM_GAP;
      setSurfaceHeight(Math.max(MIN_SURFACE_HEIGHT, Math.round(available)));
    };

    measure();
    window.addEventListener("resize", measure);
    // The error banner and rail can reflow the surface without a window resize.
    const observer = new ResizeObserver(measure);
    if (surfaceRef.current?.parentElement) observer.observe(surfaceRef.current.parentElement);
    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [isExpanded, activeId, error]);

  // Excalidraw reads its canvas size from the container, so it has to be told
  // when the fullscreen toggle changes that container's box.
  useEffect(() => {
    excalidrawApiRef.current?.refresh();
  }, [surfaceHeight, isExpanded]);

  // ── Board management ───────────────────────────────────────────────────────
  const handleCreate = async () => {
    const name = prompt("Name this canvas:", `Sketch ${canvases.length + 1}`);
    if (!name) return;
    try {
      const meta = await api.createCanvas(name);
      setCanvases((prev) => [...prev, meta]);
      setActiveId(meta.id);
    } catch {
      setError("Failed to create canvas.");
    }
  };

  const handleDelete = async (id: string) => {
    const target = canvases.find((c) => c.id === id);
    if (!confirm(`Delete "${target?.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteCanvas(id);
      localStorage.removeItem(viewportKey(id));
      const remaining = canvases.filter((c) => c.id !== id);
      setCanvases(remaining);
      if (activeId === id) {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        setActiveId(remaining[0]?.id ?? null);
      }
    } catch {
      setError("Failed to delete canvas.");
    }
  };

  const commitRename = async (id: string) => {
    const name = renameDraft.trim();
    setRenamingId(null);
    if (!name || name === canvases.find((c) => c.id === id)?.name) return;
    setCanvases((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    try {
      await api.renameCanvas(id, name);
    } catch {
      setError("Failed to rename canvas.");
      loadList();
    }
  };

  const handleExportPng = async () => {
    const excalidrawApi = excalidrawApiRef.current;
    if (!excalidrawApi) return;
    const elements = excalidrawApi.getSceneElements();
    if (elements.length === 0) return;

    const blob = await exportToBlob({
      elements,
      appState: { ...excalidrawApi.getAppState(), exportBackground: true, exportWithDarkMode: isDarkMode },
      files: excalidrawApi.getFiles(),
      mimeType: "image/png",
      quality: 1,
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeCanvas?.name || "canvas"}.png`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // initialData is read once per mount, so the Excalidraw instance is keyed by
  // canvas id and this only needs to recompute when the loaded scene changes.
  const initialData = useMemo(() => {
    if (!activeCanvas) return null;
    return {
      elements: (activeCanvas.scene.elements ?? []) as ExcalidrawElement[],
      appState: {
        ...(activeCanvas.scene.appState ?? {}),
        ...readViewport(activeCanvas.id),
        // The `theme` prop is only synced on update, never on mount — without
        // this a canvas opened while the app is already dark renders light.
        theme: isDarkMode ? "dark" : "light",
        // Rehydrated from JSON, so anything Excalidraw expects as a live
        // structure (collaborators is a Map) must not be carried over.
        collaborators: undefined,
      },
      files: activeCanvas.scene.files ?? {},
      scrollToContent: true,
    };
    // isDarkMode is deliberately excluded: remounting on every theme toggle
    // would discard undo history. The `theme` prop handles live toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCanvas]);

  const statusPill = () => {
    const base = "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider";
    switch (saveState) {
      case "saving":
        return <span className={`${base} bg-slate-100 dark:bg-slate-800 text-slate-500`}><Loader2 className="w-3 h-3 animate-spin" /> Saving</span>;
      case "dirty":
        return <span className={`${base} bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400`}><Clock className="w-3 h-3" /> Unsaved</span>;
      case "saved":
        return <span className={`${base} bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400`}><Check className="w-3 h-3" /> Saved</span>;
      case "error":
        return <span className={`${base} bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400`}><CloudOff className="w-3 h-3" /> Save failed</span>;
      default:
        return <span className={`${base} bg-slate-100 dark:bg-slate-800/60 text-slate-400`}>Synced</span>;
    }
  };

  if (!projectId) {
    return (
      <div className="bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-[#262f45] rounded-2xl p-12 text-center">
        <FolderKanban className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Select a project first</p>
        <p className="text-xs text-slate-400 mt-1">Canvases live inside a project workspace.</p>
      </div>
    );
  }

  return (
    <div
      className={
        isExpanded
          ? "fixed inset-0 z-50 p-3 bg-slate-50 dark:bg-[#0b0f1a] flex"
          : "flex flex-col lg:flex-row gap-4 h-full"
      }
    >
      {/* Canvas list rail — hidden in fullscreen to hand the width to the canvas */}
      <aside
        className={`lg:w-64 shrink-0 bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-[#262f45] rounded-2xl p-3 flex-col ${
          isExpanded ? "hidden" : "flex"
        }`}
      >
        <div className="flex items-center justify-between px-1 pb-3 mb-2 border-b border-slate-50 dark:border-slate-800/60">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest flex items-center gap-1.5">
            <PenTool className="w-3 h-3" />
            Canvases
          </p>
          <button
            onClick={loadList}
            title="Refresh list"
            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingList ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex-1 lg:max-h-[calc(100vh-360px)] overflow-y-auto no-scrollbar space-y-1">
          {isLoadingList && canvases.length === 0 && (
            <div className="py-8 text-center">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin mx-auto" />
            </div>
          )}

          {!isLoadingList && canvases.length === 0 && (
            <div className="py-8 px-2 text-center">
              <PenTool className="w-7 h-7 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-[11px] text-slate-400 leading-relaxed">No canvases yet. Create one to start sketching architecture, flows or wireframes.</p>
            </div>
          )}

          {canvases.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-xl transition-all ${
                activeId === c.id
                  ? "bg-indigo-50 dark:bg-indigo-900/30"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              {renamingId === c.id ? (
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onBlur={() => commitRename(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(c.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 text-xs rounded-lg px-2.5 py-2 outline-none text-slate-700 dark:text-slate-200"
                />
              ) : (
                <button
                  onClick={() => setActiveId(c.id)}
                  className="flex-1 min-w-0 text-left px-3 py-2.5 cursor-pointer"
                >
                  <span
                    className={`block truncate text-xs font-semibold ${
                      activeId === c.id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {c.name}
                  </span>
                  <span className="block text-[9px] text-slate-400 font-mono uppercase tracking-wider truncate">
                    {relativeTime(c.updatedAt)}
                    {c.updatedBy ? ` · ${c.updatedBy}` : ""}
                  </span>
                </button>
              )}

              <div className="flex items-center pr-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setRenamingId(c.id);
                    setRenameDraft(c.name);
                  }}
                  title="Rename"
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-500 cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  title="Delete"
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleCreate}
          className="mt-3 w-full px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          New Canvas
        </button>
      </aside>

      {/* Drawing surface */}
      <section className="flex-1 min-w-0 bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-[#262f45] rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-800/60">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
              {activeCanvas?.name ?? "No canvas open"}
            </p>
            <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider truncate">
              {activeCanvas ? `Last edit ${relativeTime(activeCanvas.updatedAt)} · ${currentUser}` : "Create or pick a canvas from the list"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeCanvas && statusPill()}
            {activeCanvas && (
              <button
                onClick={handleExportPng}
                title="Export as PNG"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white rounded-lg text-[10px] font-semibold transition-all cursor-pointer"
              >
                <ImageDown className="w-3.5 h-3.5" />
                PNG
              </button>
            )}
            {activeCanvas && (
              <button
                onClick={() => setIsExpanded((v) => !v)}
                title={isExpanded ? "Exit fullscreen" : "Fullscreen canvas"}
                className="w-7 h-7 flex items-center justify-center bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white rounded-lg transition-all cursor-pointer"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 bg-rose-50 dark:bg-rose-900/20 border-b border-rose-100 dark:border-rose-900/40 text-[11px] text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* `select-none` on the app root breaks Excalidraw's text editing, so the
            drawing surface opts back in. */}
        <div ref={surfaceRef} style={{ height: surfaceHeight }} className="flex-1 relative select-text">
          {isLoadingScene && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-[#151b2b]/70 backdrop-blur-sm">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          )}

          {activeCanvas && initialData ? (
            <Excalidraw
              key={activeCanvas.id}
              excalidrawAPI={(instance) => (excalidrawApiRef.current = instance)}
              initialData={initialData}
              onChange={handleChange}
              theme={isDarkMode ? "dark" : "light"}
              name={activeCanvas.name}
              UIOptions={{ canvasActions: { loadScene: true, export: false, saveAsImage: true } }}
            >
              <MainMenu>
                <MainMenu.DefaultItems.LoadScene />
                <MainMenu.DefaultItems.SaveAsImage />
                <MainMenu.DefaultItems.ClearCanvas />
                <MainMenu.Separator />
                <MainMenu.DefaultItems.ChangeCanvasBackground />
              </MainMenu>
              <WelcomeScreen>
                <WelcomeScreen.Hints.MenuHint />
                <WelcomeScreen.Hints.ToolbarHint />
                <WelcomeScreen.Center>
                  {/* The logo slot is what pushes the heading clear of the
                      toolbar hint — without it the two texts overlap. */}
                  <WelcomeScreen.Center.Logo>
                    <PenTool className="w-8 h-8" />
                  </WelcomeScreen.Center.Logo>
                  <WelcomeScreen.Center.Heading>
                    Autosaves to the project.
                  </WelcomeScreen.Center.Heading>
                  <WelcomeScreen.Center.Menu>
                    <WelcomeScreen.Center.MenuItemLoadScene />
                    <WelcomeScreen.Center.MenuItemHelp />
                  </WelcomeScreen.Center.Menu>
                </WelcomeScreen.Center>
              </WelcomeScreen>
            </Excalidraw>
          ) : (
            !isLoadingScene && (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                  <PenTool className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nothing open</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Whiteboard your system diagrams, sprint flows and UI wireframes next to the board.
                </p>
                <button
                  onClick={handleCreate}
                  className="mt-5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Canvas
                </button>
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}
