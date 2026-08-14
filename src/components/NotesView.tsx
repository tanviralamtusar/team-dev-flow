import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import * as api from "../api";
import { Note, NoteMeta } from "../types";
import {
  FileText,
  Plus,
  Trash2,
  Loader2,
  Check,
  CloudOff,
  RefreshCw,
  Clock,
  FolderKanban,
  Maximize2,
  Minimize2,
  Search,
  Pin,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code2,
  Link2,
  Unlink,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Minus,
  RemoveFormatting,
  Palette,
  Highlighter,
  IndentIncrease,
  IndentDecrease,
  Download,
  ChevronDown,
} from "lucide-react";

interface NotesViewProps {
  projectId: string;
  currentUser: string;
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 1200;
const MIN_SURFACE_HEIGHT = 460;
/** Breathing room between the document surface and whatever sits under it. */
const SURFACE_BOTTOM_GAP = 24;

// ── HTML sanitising ──────────────────────────────────────────────────────────
// The body is contentEditable HTML that every project member loads, so both
// pasted markup and anything the server hands back is filtered down to a known
// tag/attribute set before it ever reaches the DOM.

const ALLOWED_TAGS = new Set([
  "p", "div", "br", "span", "b", "strong", "i", "em", "u", "s", "strike", "del", "mark",
  "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code", "hr",
  "a", "img", "table", "thead", "tbody", "tr", "th", "td", "sub", "sup", "font",
]);

/** Dropped outright — unwrapping these would leak their contents as text. */
const DROP_TAGS = new Set([
  "script", "style", "iframe", "object", "embed", "link", "meta", "form",
  "input", "textarea", "select", "button", "svg", "math", "base", "title",
]);

const TAG_ATTRS: Record<string, string[]> = {
  a: ["href", "title"],
  img: ["src", "alt", "width", "height"],
  font: ["color", "face", "size"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
};

const ALLOWED_STYLE_PROPS = new Set([
  "color", "background-color", "text-align", "font-weight", "font-style",
  "text-decoration", "font-family", "font-size",
]);

const sanitizeStyle = (value: string) =>
  value
    .split(";")
    .map((decl) => decl.trim())
    .filter((decl) => {
      const idx = decl.indexOf(":");
      if (idx < 0) return false;
      const prop = decl.slice(0, idx).trim().toLowerCase();
      const val = decl.slice(idx + 1);
      if (!ALLOWED_STYLE_PROPS.has(prop)) return false;
      return !/url\s*\(|expression|javascript:/i.test(val);
    })
    .join("; ");

const isSafeUrl = (tag: string, value: string) => {
  const url = value.trim().toLowerCase();
  // Inline images survive a copy/paste from another doc, so keep data: images —
  // every other scheme that can execute is rejected.
  if (url.startsWith("data:")) return tag === "img" && url.startsWith("data:image/");
  return !/^(javascript|vbscript|file):/i.test(url);
};

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");

  const clean = (parent: Element) => {
    Array.from(parent.children).forEach((el) => {
      const tag = el.tagName.toLowerCase();

      if (DROP_TAGS.has(tag)) {
        el.remove();
        return;
      }

      if (!ALLOWED_TAGS.has(tag)) {
        clean(el);
        el.replaceWith(...Array.from(el.childNodes));
        return;
      }

      Array.from(el.attributes).forEach(({ name, value }) => {
        const attr = name.toLowerCase();
        if (attr === "style") {
          const safe = sanitizeStyle(value);
          if (safe) el.setAttribute("style", safe);
          else el.removeAttribute(name);
          return;
        }
        if (!(TAG_ATTRS[tag] ?? []).includes(attr)) {
          el.removeAttribute(name);
          return;
        }
        if ((attr === "href" || attr === "src") && !isSafeUrl(tag, value)) {
          el.removeAttribute(name);
        }
      });

      if (tag === "a" && el.getAttribute("href")) {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer nofollow");
      }

      clean(el);
    });
  };

  clean(doc.body);
  return doc.body.innerHTML;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "li"]);

const TEXT_COLORS = ["#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#4f46e5", "#9333ea", "#64748b"];
const HIGHLIGHTS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#e9d5ff", "#fed7aa", "transparent"];

interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  ul: boolean;
  ol: boolean;
  link: boolean;
  block: string;
  align: "left" | "center" | "right";
}

const INITIAL_FORMAT: FormatState = {
  bold: false, italic: false, underline: false, strike: false,
  ul: false, ol: false, link: false, block: "p", align: "left",
};

const BLOCK_LABELS: Record<string, string> = {
  p: "Normal text",
  h1: "Title",
  h2: "Heading",
  h3: "Subheading",
  blockquote: "Quote",
  pre: "Code block",
};

// ── Toolbar primitives ───────────────────────────────────────────────────────

const ToolButton = ({
  onClick,
  active,
  title,
  children,
  disabled,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) => (
  <button
    type="button"
    title={title}
    disabled={disabled}
    // Keep the caret where it is — losing the selection on mousedown would make
    // every command apply to nothing.
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-default ${
      active
        ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300"
        : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white"
    }`}
  >
    {children}
  </button>
);

const Divider = () => <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />;

// ── View ─────────────────────────────────────────────────────────────────────

export default function NotesView({ projectId, currentUser }: NotesViewProps) {
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingNote, setIsLoadingNote] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [surfaceHeight, setSurfaceHeight] = useState<number>(MIN_SURFACE_HEIGHT);
  const [format, setFormat] = useState<FormatState>(INITIAL_FORMAT);
  const [openPicker, setOpenPicker] = useState<"style" | "color" | "highlight" | null>(null);
  const [wordCount, setWordCount] = useState(0);

  const editorRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIdRef = useRef<string | null>(null);
  /** HTML as last persisted — guards against saving on pure caret movement. */
  const savedHtmlRef = useRef<string>("");
  /** Body of the note being opened, held until the editor node exists. */
  const pendingHtmlRef = useRef<string>("");
  /** Note whose body is currently in the editor DOM. */
  const loadedIdRef = useRef<string | null>(null);
  const pendingTitleRef = useRef<{ id: string; title: string } | null>(null);
  const focusTitleRef = useRef(false);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // ── Loading ────────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    if (!projectId) {
      setNotes([]);
      setIsLoadingList(false);
      return;
    }
    setIsLoadingList(true);
    try {
      const list = await api.getNotes();
      setNotes(list);
      setError(null);
      setActiveId((prev) => (prev && list.some((n) => n.id === prev) ? prev : list[0]?.id ?? null));
    } catch {
      setError("Could not reach the notes service.");
    } finally {
      setIsLoadingList(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Switching projects invalidates the open document.
  useEffect(() => {
    setActiveId(null);
    setActiveNote(null);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    if (!activeId) {
      setActiveNote(null);
      setTitle("");
      loadedIdRef.current = null;
      return;
    }
    setIsLoadingNote(true);
    api
      .getNote(activeId)
      .then((note) => {
        if (cancelled) return;
        const html = sanitizeHtml(note.content || "");
        // The editor node only mounts once a note is open, so hand the body to
        // the layout effect below rather than writing to a ref that may be null.
        pendingHtmlRef.current = html;
        savedHtmlRef.current = html;
        setActiveNote(note);
        setTitle(note.title);
        setSaveState("idle");
        setFormat(INITIAL_FORMAT);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to open this note.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingNote(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // ── Editor chrome (placeholder + counts) ───────────────────────────────────
  const syncEditorChrome = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const text = el.textContent ?? "";
    const hasEmbeds = !!el.querySelector("img, hr, table");
    el.dataset.empty = text.trim() === "" && !hasEmbeds ? "true" : "false";
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
  }, []);

  // Inject the loaded body once the editor node exists. Keyed on the note id so
  // an autosave refreshing `activeNote` metadata never overwrites live typing.
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el || !activeNote || loadedIdRef.current === activeNote.id) return;
    el.innerHTML = pendingHtmlRef.current;
    loadedIdRef.current = activeNote.id;
    syncEditorChrome();
    if (focusTitleRef.current) {
      focusTitleRef.current = false;
      titleRef.current?.select();
    }
  }, [activeNote, syncEditorChrome]);

  // ── Saving ─────────────────────────────────────────────────────────────────
  const persistContent = useCallback(async () => {
    const el = editorRef.current;
    const noteId = activeIdRef.current;
    if (!el || !noteId) return;
    // Never write back an editor that has not been filled with this note's body
    // — an in-flight open would otherwise persist as an empty document.
    if (loadedIdRef.current !== noteId) return;

    const html = sanitizeHtml(el.innerHTML);
    if (html === savedHtmlRef.current) {
      setSaveState("saved");
      return;
    }

    setSaveState("saving");
    try {
      const meta = await api.saveNoteContent(noteId, html);
      savedHtmlRef.current = html;
      setSaveState("saved");
      setNotes((prev) => prev.map((n) => (n.id === meta.id ? { ...n, ...meta } : n)));
      setActiveNote((prev) => (prev && prev.id === meta.id ? { ...prev, ...meta } : prev));
    } catch {
      setSaveState("error");
    }
  }, []);

  const queueSave = useCallback(() => {
    setSaveState("dirty");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      persistContent();
    }, AUTOSAVE_DELAY_MS);
  }, [persistContent]);

  const handleInput = useCallback(() => {
    syncEditorChrome();
    queueSave();
  }, [queueSave, syncEditorChrome]);

  /** Commit anything still sitting on a debounce timer, body and title alike. */
  const flushPending = useCallback(() => {
    if (titleTimerRef.current) {
      clearTimeout(titleTimerRef.current);
      titleTimerRef.current = null;
      const pending = pendingTitleRef.current;
      pendingTitleRef.current = null;
      if (pending) api.renameNote(pending.id, pending.title).catch(() => setSaveState("error"));
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      persistContent();
    }
  }, [persistContent]);

  // Flush pending edits when the note is swapped out or the view unmounts.
  // Cleanups run before the effect that re-points activeIdRef, so this still
  // saves against the note that was actually being edited.
  useEffect(() => {
    return flushPending;
  }, [activeId, flushPending]);

  useEffect(() => {
    window.addEventListener("beforeunload", flushPending);
    return () => window.removeEventListener("beforeunload", flushPending);
  }, [flushPending]);

  // ── Formatting ─────────────────────────────────────────────────────────────
  const selectionInEditor = () => {
    const sel = window.getSelection();
    return !!sel && !!sel.anchorNode && !!editorRef.current?.contains(sel.anchorNode);
  };

  const refreshFormat = useCallback(() => {
    if (!selectionInEditor()) return;

    let block = "p";
    let align: FormatState["align"] = "left";
    const sel = window.getSelection();
    let node: Node | null = sel?.anchorNode ?? null;
    while (node && node !== editorRef.current) {
      if (node.nodeType === 1) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (block === "p" && BLOCK_TAGS.has(tag) && tag !== "li" && tag !== "div") block = tag;
        const declared = el.style.textAlign || "";
        if (align === "left" && (declared === "center" || declared === "right")) align = declared;
      }
      node = node.parentNode;
    }

    const state = (cmd: string) => {
      try {
        return document.queryCommandState(cmd);
      } catch {
        return false;
      }
    };

    setFormat({
      bold: state("bold"),
      italic: state("italic"),
      underline: state("underline"),
      strike: state("strikeThrough"),
      ul: state("insertUnorderedList"),
      ol: state("insertOrderedList"),
      link: !!(sel?.anchorNode && (sel.anchorNode.parentElement as HTMLElement | null)?.closest("a")),
      block,
      align,
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshFormat);
    return () => document.removeEventListener("selectionchange", refreshFormat);
  }, [refreshFormat]);

  const exec = useCallback(
    (command: string, value?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, value);
      handleInput();
      refreshFormat();
    },
    [handleInput, refreshFormat]
  );

  const applyBlock = useCallback(
    (tag: string) => {
      setOpenPicker(null);
      // Lists own their block context; formatBlock inside one produces invalid
      // markup, so step out of the list first.
      if (format.ul) exec("insertUnorderedList");
      if (format.ol) exec("insertOrderedList");
      exec("formatBlock", `<${tag}>`);
    },
    [exec, format.ol, format.ul]
  );

  const applyColor = useCallback(
    (command: "foreColor" | "hiliteColor", color: string) => {
      setOpenPicker(null);
      editorRef.current?.focus();
      // Colours must land as CSS — the legacy <font> output they default to is
      // stripped of most styling by the sanitiser and by Tailwind's reset.
      document.execCommand("styleWithCSS", false, "true");
      const applied = document.execCommand(command, false, color);
      if (!applied && command === "hiliteColor") document.execCommand("backColor", false, color);
      document.execCommand("styleWithCSS", false, "false");
      handleInput();
      refreshFormat();
    },
    [handleInput, refreshFormat]
  );

  const handleLink = useCallback(() => {
    if (format.link) {
      exec("unlink");
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setError("Select the text you want to link first.");
      return;
    }
    const url = prompt("Link URL:", "https://");
    if (!url) return;
    const safe = url.trim();
    if (!isSafeUrl("a", safe)) {
      setError("That link scheme is not allowed.");
      return;
    }
    setError(null);
    exec("createLink", safe);
  }, [exec, format.link]);

  // Pasted markup goes through the same filter as loaded documents, and plain
  // text is inserted verbatim so code snippets keep their shape.
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const html = e.clipboardData.getData("text/html");
      const text = e.clipboardData.getData("text/plain");
      if (!html && !text) return;
      e.preventDefault();
      if (html) document.execCommand("insertHTML", false, sanitizeHtml(html));
      else document.execCommand("insertText", false, text);
      handleInput();
      refreshFormat();
    },
    [handleInput, refreshFormat]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flushPending();
        return;
      }
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        handleLink();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        exec(e.shiftKey ? "outdent" : "indent");
      }
    },
    [exec, flushPending, handleLink]
  );

  // ── Note management ────────────────────────────────────────────────────────
  const handleCreate = async () => {
    try {
      const meta = await api.createNote("Untitled document");
      setNotes((prev) => [meta, ...prev]);
      focusTitleRef.current = true;
      setActiveId(meta.id);
      setError(null);
    } catch {
      setError("Failed to create note.");
    }
  };

  const handleDelete = async (id: string) => {
    const target = notes.find((n) => n.id === id);
    if (!confirm(`Delete "${target?.title}"? This cannot be undone.`)) return;
    try {
      await api.deleteNote(id);
      const remaining = notes.filter((n) => n.id !== id);
      setNotes(remaining);
      if (activeId === id) {
        // Drop any queued write for the note that no longer exists.
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        if (titleTimerRef.current) {
          clearTimeout(titleTimerRef.current);
          titleTimerRef.current = null;
        }
        pendingTitleRef.current = null;
        savedHtmlRef.current = "";
        loadedIdRef.current = null;
        setActiveId(remaining[0]?.id ?? null);
      }
    } catch {
      setError("Failed to delete note.");
    }
  };

  const handleTogglePin = async (note: NoteMeta) => {
    const pinned = !note.pinned;
    setNotes((prev) =>
      [...prev.map((n) => (n.id === note.id ? { ...n, pinned } : n))].sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    );
    try {
      await api.setNotePinned(note.id, pinned);
    } catch {
      setError("Failed to update pin.");
      loadList();
    }
  };

  // Renames debounce like the body does, so typing a title is not one request
  // per keystroke.
  const handleTitleChange = (value: string) => {
    setTitle(value);
    const noteId = activeIdRef.current;
    if (!noteId) return;
    setSaveState("dirty");
    pendingTitleRef.current = { id: noteId, title: value.trim() || "Untitled document" };
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(async () => {
      titleTimerRef.current = null;
      pendingTitleRef.current = null;
      try {
        const meta = await api.renameNote(noteId, value.trim() || "Untitled document");
        setNotes((prev) => prev.map((n) => (n.id === meta.id ? { ...n, ...meta } : n)));
        setActiveNote((prev) => (prev && prev.id === meta.id ? { ...prev, ...meta } : prev));
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, AUTOSAVE_DELAY_MS);
  };

  const handleExport = () => {
    if (!activeNote || !editorRef.current) return;
    const docTitle = title.trim() || "Untitled document";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${docTitle.replace(
      /[<>&]/g,
      (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string)
    )}</title></head><body><h1>${docTitle}</h1>${sanitizeHtml(editorRef.current.innerHTML)}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${docTitle}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Sizing ─────────────────────────────────────────────────────────────────
  // Measure where the document surface actually starts and stretch it to the
  // footer, so the page scrolls internally instead of growing the whole app.
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
    const observer = new ResizeObserver(measure);
    if (surfaceRef.current?.parentElement) observer.observe(surfaceRef.current.parentElement);
    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [isExpanded, activeId, error]);

  // Close a colour/style popover on any outside click.
  useEffect(() => {
    if (!openPicker) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-picker]")) setOpenPicker(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openPicker]);

  const visibleNotes = search.trim()
    ? notes.filter((n) =>
        `${n.title} ${n.excerpt}`.toLowerCase().includes(search.trim().toLowerCase())
      )
    : notes;

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
        <p className="text-xs text-slate-400 mt-1">Notes live inside a project workspace.</p>
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
      {/* Note list rail — hidden in fullscreen to hand the width to the page */}
      <aside
        className={`lg:w-72 shrink-0 bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-[#262f45] rounded-2xl p-3 flex-col ${
          isExpanded ? "hidden" : "flex"
        }`}
      >
        <div className="flex items-center justify-between px-1 pb-3 mb-2 border-b border-slate-50 dark:border-slate-800/60">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono uppercase tracking-widest flex items-center gap-1.5">
            <FileText className="w-3 h-3" />
            Notes
            <span className="text-slate-300 dark:text-slate-600">{notes.length}</span>
          </p>
          <button
            onClick={loadList}
            title="Refresh list"
            className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingList ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[11px] rounded-xl pl-9 pr-3 py-2 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-all text-slate-600 dark:text-slate-300 placeholder-slate-400/60"
          />
        </div>

        <div className="flex-1 lg:max-h-[calc(100vh-400px)] overflow-y-auto no-scrollbar space-y-1">
          {isLoadingList && notes.length === 0 && (
            <div className="py-8 text-center">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin mx-auto" />
            </div>
          )}

          {!isLoadingList && notes.length === 0 && (
            <div className="py-8 px-2 text-center">
              <FileText className="w-7 h-7 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                No notes yet. Draft specs, meeting minutes or release notes right next to the board.
              </p>
            </div>
          )}

          {!isLoadingList && notes.length > 0 && visibleNotes.length === 0 && (
            <p className="py-8 text-center text-[11px] text-slate-400">No notes match “{search}”.</p>
          )}

          {visibleNotes.map((n) => (
            <div
              key={n.id}
              className={`group flex items-start gap-1 rounded-xl transition-all ${
                activeId === n.id
                  ? "bg-indigo-50 dark:bg-indigo-900/30"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <button
                onClick={() => setActiveId(n.id)}
                className="flex-1 min-w-0 text-left px-3 py-2.5 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  {n.pinned && <Pin className="w-2.5 h-2.5 text-amber-500 shrink-0 fill-amber-500" />}
                  <span
                    className={`block truncate text-xs font-semibold ${
                      activeId === n.id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {n.title}
                  </span>
                </span>
                {n.excerpt && (
                  <span className="block text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {n.excerpt}
                  </span>
                )}
                <span className="block text-[9px] text-slate-400 font-mono uppercase tracking-wider truncate mt-0.5">
                  {relativeTime(n.updatedAt)}
                  {n.updatedBy ? ` · ${n.updatedBy}` : ""}
                </span>
              </button>

              <div className="flex items-center pr-1.5 pt-2.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  onClick={() => handleTogglePin(n)}
                  title={n.pinned ? "Unpin" : "Pin to top"}
                  className={`w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer ${
                    n.pinned ? "text-amber-500" : "text-slate-400 hover:text-amber-500"
                  }`}
                >
                  <Pin className="w-3 h-3" />
                </button>
                <button
                  onClick={() => handleDelete(n.id)}
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
          New Note
        </button>
      </aside>

      {/* Document surface */}
      <section className="flex-1 min-w-0 bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-[#262f45] rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-800/60">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
              {activeNote ? title || "Untitled document" : "No note open"}
            </p>
            <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider truncate">
              {activeNote
                ? `${wordCount} words · Last edit ${relativeTime(activeNote.updatedAt)} · ${currentUser}`
                : "Create or pick a note from the list"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeNote && statusPill()}
            {activeNote && (
              <button
                onClick={handleExport}
                title="Download as HTML"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white rounded-lg text-[10px] font-semibold transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                HTML
              </button>
            )}
            {activeNote && (
              <button
                onClick={() => setIsExpanded((v) => !v)}
                title={isExpanded ? "Exit fullscreen" : "Fullscreen editor"}
                className="w-7 h-7 flex items-center justify-center bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white rounded-lg transition-all cursor-pointer"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Formatting toolbar */}
        {activeNote && (
          <div className="flex items-center gap-0.5 px-3 py-2 border-b border-slate-50 dark:border-slate-800/60 overflow-x-auto no-scrollbar">
            <ToolButton onClick={() => exec("undo")} title="Undo (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /></ToolButton>
            <ToolButton onClick={() => exec("redo")} title="Redo (Ctrl+Shift+Z)"><Redo2 className="w-3.5 h-3.5" /></ToolButton>
            <Divider />

            {/* Paragraph style */}
            <div className="relative shrink-0" data-picker>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpenPicker(openPicker === "style" ? null : "style")}
                className="h-7 px-2.5 flex items-center gap-1.5 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer whitespace-nowrap"
              >
                {BLOCK_LABELS[format.block] ?? "Normal text"}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {openPicker === "style" && (
                <div className="absolute left-0 top-full mt-1.5 w-44 bg-white dark:bg-[#1e293b] border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl z-30 p-1.5">
                  {Object.entries(BLOCK_LABELS).map(([tag, label]) => (
                    <button
                      key={tag}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyBlock(tag)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all cursor-pointer ${
                        format.block === tag
                          ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      } ${tag === "h1" ? "text-base font-bold" : tag === "h2" ? "text-sm font-bold" : tag === "h3" ? "text-[13px] font-semibold" : "text-xs"} ${
                        tag === "pre" ? "font-mono" : ""
                      } ${tag === "blockquote" ? "italic" : ""}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Divider />

            <ToolButton onClick={() => exec("bold")} active={format.bold} title="Bold (Ctrl+B)"><Bold className="w-3.5 h-3.5" /></ToolButton>
            <ToolButton onClick={() => exec("italic")} active={format.italic} title="Italic (Ctrl+I)"><Italic className="w-3.5 h-3.5" /></ToolButton>
            <ToolButton onClick={() => exec("underline")} active={format.underline} title="Underline (Ctrl+U)"><Underline className="w-3.5 h-3.5" /></ToolButton>
            <ToolButton onClick={() => exec("strikeThrough")} active={format.strike} title="Strikethrough"><Strikethrough className="w-3.5 h-3.5" /></ToolButton>

            {/* Text colour */}
            <div className="relative shrink-0" data-picker>
              <ToolButton onClick={() => setOpenPicker(openPicker === "color" ? null : "color")} title="Text colour">
                <Palette className="w-3.5 h-3.5" />
              </ToolButton>
              {openPicker === "color" && (
                <div className="absolute left-0 top-full mt-1.5 w-40 bg-white dark:bg-[#1e293b] border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl z-30 p-2 grid grid-cols-5 gap-1.5">
                  <button
                    key="default"
                    title="Default (matches theme)"
                    onMouseDown={(e) => e.preventDefault()}
                    // Reads the theme's own --color-geom-text value at click time rather
                    // than a hardcoded hex, so it always matches the note body's actual
                    // default ink (near-white in dark mode, not a fixed dark swatch that
                    // would be unreadable on the dark background).
                    onClick={() =>
                      applyColor(
                        "foreColor",
                        getComputedStyle(document.documentElement).getPropertyValue("--color-geom-text").trim()
                      )
                    }
                    className="w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer hover:scale-110 transition-transform bg-geom-text flex items-center justify-center"
                  >
                    <RemoveFormatting className="w-3 h-3 text-slate-400" />
                  </button>
                  {TEXT_COLORS.map((c) => (
                    <button
                      key={c}
                      title={c}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyColor("foreColor", c)}
                      style={{ backgroundColor: c }}
                      className="w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer hover:scale-110 transition-transform"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Highlight */}
            <div className="relative shrink-0" data-picker>
              <ToolButton onClick={() => setOpenPicker(openPicker === "highlight" ? null : "highlight")} title="Highlight">
                <Highlighter className="w-3.5 h-3.5" />
              </ToolButton>
              {openPicker === "highlight" && (
                <div className="absolute left-0 top-full mt-1.5 w-40 bg-white dark:bg-[#1e293b] border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl z-30 p-2 grid grid-cols-5 gap-1.5">
                  {HIGHLIGHTS.map((c) => (
                    <button
                      key={c}
                      title={c === "transparent" ? "None" : c}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyColor("hiliteColor", c)}
                      style={{ backgroundColor: c === "transparent" ? undefined : c }}
                      className="w-6 h-6 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer hover:scale-110 transition-transform flex items-center justify-center"
                    >
                      {c === "transparent" && <Minus className="w-3 h-3 text-slate-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Divider />

            <ToolButton onClick={() => exec("insertUnorderedList")} active={format.ul} title="Bulleted list"><List className="w-3.5 h-3.5" /></ToolButton>
            <ToolButton onClick={() => exec("insertOrderedList")} active={format.ol} title="Numbered list"><ListOrdered className="w-3.5 h-3.5" /></ToolButton>
            <ToolButton onClick={() => exec("outdent")} title="Decrease indent (Shift+Tab)"><IndentDecrease className="w-3.5 h-3.5" /></ToolButton>
            <ToolButton onClick={() => exec("indent")} title="Increase indent (Tab)"><IndentIncrease className="w-3.5 h-3.5" /></ToolButton>
            <Divider />

            <ToolButton onClick={() => exec("justifyLeft")} active={format.align === "left"} title="Align left"><AlignLeft className="w-3.5 h-3.5" /></ToolButton>
            <ToolButton onClick={() => exec("justifyCenter")} active={format.align === "center"} title="Align centre"><AlignCenter className="w-3.5 h-3.5" /></ToolButton>
            <ToolButton onClick={() => exec("justifyRight")} active={format.align === "right"} title="Align right"><AlignRight className="w-3.5 h-3.5" /></ToolButton>
            <Divider />

            <ToolButton onClick={() => applyBlock("blockquote")} active={format.block === "blockquote"} title="Quote"><Quote className="w-3.5 h-3.5" /></ToolButton>
            <ToolButton onClick={() => applyBlock("pre")} active={format.block === "pre"} title="Code block"><Code2 className="w-3.5 h-3.5" /></ToolButton>
            <ToolButton onClick={handleLink} active={format.link} title={format.link ? "Remove link" : "Insert link (Ctrl+K)"}>
              {format.link ? <Unlink className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
            </ToolButton>
            <ToolButton onClick={() => exec("insertHorizontalRule")} title="Divider"><Minus className="w-3.5 h-3.5" /></ToolButton>
            <ToolButton onClick={() => exec("removeFormat")} title="Clear formatting"><RemoveFormatting className="w-3.5 h-3.5" /></ToolButton>
          </div>
        )}

        {error && (
          <div className="px-4 py-2 bg-rose-50 dark:bg-rose-900/20 border-b border-rose-100 dark:border-rose-900/40 text-[11px] text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        <div
          ref={surfaceRef}
          style={{ height: surfaceHeight }}
          className="relative w-full overflow-y-auto bg-slate-50/70 dark:bg-[#0f1626]"
        >
          {isLoadingNote && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-[#151b2b]/70 backdrop-blur-sm">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          )}

          {activeNote ? (
            /* `select-none` on the app root would block text selection, so the
               page opts back in. */
            <div className="mx-auto w-full max-w-[820px] my-6 px-6 sm:px-12 py-10 bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-[#262f45] rounded-2xl shadow-sm select-text">
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    editorRef.current?.focus();
                  }
                }}
                placeholder="Untitled document"
                className="w-full bg-transparent border-0 outline-none text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 mb-1"
              />
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mb-6 pb-5 border-b border-slate-100 dark:border-slate-800/60">
                {wordCount} words · edited {relativeTime(activeNote.updatedAt)}
                {activeNote.updatedBy ? ` by ${activeNote.updatedBy}` : ""}
              </p>

              <div
                // Remounting per note keeps one document's undo stack out of
                // the next one's.
                key={activeNote.id}
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                spellCheck
                role="textbox"
                aria-multiline="true"
                aria-label="Note body"
                data-placeholder="Start writing, or paste something in…"
                data-empty="true"
                onInput={handleInput}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                onBlur={refreshFormat}
                className="note-doc min-h-[45vh]"
              />
            </div>
          ) : (
            !isLoadingNote && (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4">
                  <FileText className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nothing open</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Keep specs, standup notes and release checklists in the same workspace as the board.
                </p>
                <button
                  onClick={handleCreate}
                  className="mt-5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Note
                </button>
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}
