import React, { useState } from "react";
import { Tag, Assignee, Column } from "../types";
import { 
  Users, 
  Tag as TagIcon, 
  Plus, 
  Trash, 
  Check, 
  X, 
  Briefcase, 
  Mail, 
  HelpCircle,
  Hash,
  RefreshCw,
  Sparkles
} from "lucide-react";

import * as api from "../api";

interface SettingsViewProps {
  projectId: string;
  tags: Tag[];
  assignees: Assignee[];
  columns: Column[];
  onUpdateTags: (tags: Tag[]) => void;
  onUpdateAssignees: (assignees: Assignee[]) => void;
  onUpdateColumns: (columns: Column[]) => void;
  onResetBoard: () => void;
}

const COLOR_TEMPLATES = [
  { id: "sky", name: "Sky Blue", bgClass: "bg-sky-50 text-sky-700 border-sky-100", textClass: "text-sky-700" },
  { id: "indigo", name: "Royal Purple", bgClass: "bg-indigo-50 text-indigo-700 border-indigo-100", textClass: "text-indigo-700" },
  { id: "emerald", name: "Teal Green", bgClass: "bg-emerald-50 text-emerald-700 border-emerald-100", textClass: "text-emerald-700" },
  { id: "rose", name: "Coral Rose", bgClass: "bg-rose-50 text-rose-700 border-rose-100", textClass: "text-rose-700" },
  { id: "amber", name: "Warm Amber", bgClass: "bg-amber-50 text-amber-700 border-amber-100", textClass: "text-amber-755" },
  { id: "fuchsia", name: "Magenta Pink", bgClass: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100", textClass: "text-fuchsia-700" },
];

const AVATAR_COLORS = [
  "bg-blue-600 text-white",
  "bg-emerald-600 text-white",
  "bg-indigo-600 text-white",
  "bg-rose-600 text-white",
  "bg-amber-600 text-white",
  "bg-teal-600 text-white",
  "bg-purple-600 text-white",
  "bg-pink-600 text-white",
];

export default function SettingsView({
  projectId,
  tags,
  assignees,
  columns,
  onUpdateTags,
  onUpdateAssignees,
  onUpdateColumns,
  onResetBoard,
}: SettingsViewProps) {
  
  // Tag Form States
  const [newTagName, setNewTagName] = useState("");
  const [selectedColorTemplate, setSelectedColorTemplate] = useState(COLOR_TEMPLATES[0]);

  // Column Form States
  const [newColTitle, setNewColTitle] = useState("");

  // Handler: Add Tag
  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    // Check duplicates
    if (tags.some((t) => t.name.toLowerCase() === newTagName.trim().toLowerCase())) {
      alert("A custom tag with that name already exists!");
      return;
    }

    const newTag: Tag = {
      id: `tag-${Date.now()}`,
      name: newTagName.trim(),
      color: selectedColorTemplate.id,
      bgClass: selectedColorTemplate.bgClass,
      textClass: selectedColorTemplate.textClass,
    };

    onUpdateTags([...tags, newTag]);
    setNewTagName("");
  };

  // Handler: Delete Tag
  const handleDeleteTag = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the tag "${name}"? It will be pruned from all cards referencing it.`)) {
      onUpdateTags(tags.filter((t) => t.id !== id));
    }
  };

  // Handler: Add Column
  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColTitle.trim()) return;

    const newColId = newColTitle.trim().toLowerCase().replace(/\s+/g, "_");
    
    // Checks for column collision
    if (columns.some((c) => c.id === newColId)) {
      alert("A workflow column with this key already exists!");
      return;
    }

    const newCol: Column = {
      id: newColId,
      title: newColTitle.trim(),
      color: "bg-slate-50 border-slate-200",
      textClass: "text-indigo-700 bg-indigo-50",
    };

    onUpdateColumns([...columns, newCol]);
    setNewColTitle("");
  };

  // Handler: Delete Column
  const handleDeleteColumn = (id: string, title: string) => {
    if (id === "backlog" || id === "done") {
      alert(`Standard columns like "${title}" are fundamental to structural board computations and cannot be deleted.`);
      return;
    }
    if (confirm(`Remove custom column "${title}"? Remaining tickets inside this column will automatically shift to "Backlog".`)) {
      onUpdateColumns(columns.filter((c) => c.id !== id));
    }
  };

  return (
    <div id="settings-panel-grid" className="max-w-4xl mx-auto animate-fade-in space-y-6">
      
      {/* Custom Tags management sheet */}
      <div className="bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-slate-800 p-6 rounded-2xl space-y-6 shadow-xs">
          <div>
            <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <TagIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Custom Tags Taxonomy
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Create custom classified badges to search, colorize, and filter board tickets.
            </p>
          </div>

          {/* Existing list of custom tags */}
          <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pr-1">
            {tags.map((tg) => (
              <span 
                key={tg.id} 
                className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-xl border border-slate-100 dark:border-slate-700 text-[10px] font-bold uppercase shadow-xs ${tg.bgClass}`}
              >
                {tg.name}
                <button 
                  type="button"
                  onClick={() => handleDeleteTag(tg.id, tg.name)}
                  className="p-0.5 text-slate-650 dark:text-slate-300 hover:text-rose-650 dark:hover:text-rose-400 text-slate-600 rounded cursor-pointer animate-fade-in"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          {/* New Tag Input */}
          <form onSubmit={handleAddTag} className="bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono tracking-wider uppercase block">PROVISION SYSTEM TAG</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <input
                  title="Tag identifier"
                  type="text"
                  required
                  placeholder="e.g. Hotfix, Mobile"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-xs rounded-xl p-2.5 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 font-medium text-slate-600 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>

              {/* Tag color template selection */}
              <select
                title="Select tag color template"
                value={selectedColorTemplate.id}
                onChange={(e) => {
                  const m = COLOR_TEMPLATES.find((col) => col.id === e.target.value);
                  if (m) setSelectedColorTemplate(m);
                }}
                className="bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-xs rounded-xl p-2.5 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 font-mono font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                {COLOR_TEMPLATES.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border-0 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Append Custom Tag
            </button>
          </form>
        </div>

        {/* Dynamic Workflow Column management */}
        <div className="bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-slate-800 p-6 rounded-2xl space-y-6 shadow-xs animate-fade-in">
          <div>
            <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Hash className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Workflow Column Configuration
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Refinement controls for adding custom tracking queues or resetting board configurations.
            </p>
          </div>

          <div className="space-y-2">
            {columns.map((c) => (
              <div 
                key={c.id} 
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs font-bold font-mono shadow-xs"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 border-0" />
                  <span className="text-slate-800 dark:text-slate-200 font-medium font-sans">{c.title}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">({c.id})</span>
                </div>
                
                {/* Prevent delete baseline columns */}
                {c.id !== "backlog" && c.id !== "done" ? (
                  <button 
                    type="button" 
                    onClick={() => handleDeleteColumn(c.id, c.title)}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#1e293b] transition-colors cursor-pointer shadow-xs"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl">Baseline lock</span>
                )}
              </div>
            ))}
          </div>

          {/* Quick Column Creation Form */}
          <form onSubmit={handleAddColumn} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="e.g. Needs Design, QA Hold"
              value={newColTitle}
              onChange={(e) => setNewColTitle(e.target.value)}
              className="flex-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-xs rounded-xl p-2 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 font-medium text-slate-600 dark:text-slate-300"
            />
            <button
              type="submit"
              className="px-4 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white dark:hover:text-white text-slate-700 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider rounded-xl border border-transparent dark:border-slate-700 shadow-xs hover:border-transparent flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Column
            </button>
          </form>

          {/* RESET SYSTEM */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-between items-center bg-rose-50/20 dark:bg-rose-950/10 p-4 rounded-2xl border border-dashed border-rose-300 dark:border-rose-900/40 shadow-xs">
            <div>
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wide block">Workspace Reset</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block leading-tight">Recharge default layout workspace parameters.</span>
            </div>
            <button
              onClick={() => {
                if(confirm("This resets your Kanban workspace state to defaults. Tickets, assignees and tags created during this session will be replaced by baseline standards. Continue?")) {
                  onResetBoard();
                }
              }}
              className="p-2 px-3.5 bg-white dark:bg-[#151b2b] hover:bg-rose-600 dark:hover:bg-rose-600 text-rose-800 dark:text-rose-400 hover:text-white dark:hover:text-white border border-rose-100 dark:border-rose-900/50 text-xs font-semibold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset Workspace
            </button>
          </div>
      </div>
    </div>
  );
}
