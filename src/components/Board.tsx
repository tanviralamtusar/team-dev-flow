import React, { useState } from "react";
import { BoardItem, Column, Tag, Assignee } from "../types";
import Card from "./Card";
import { Plus, BarChart2, Zap, HelpCircle } from "lucide-react";

interface BoardProps {
  items: BoardItem[];
  columns: Column[];
  tags: Tag[];
  assignees: Assignee[];
  onMoveItem: (id: string, newStatus: string) => void;
  onEditItem: (id: string) => void;
  onAddItem: (columnId: string) => void;
  
  // Filters passed from parent
  searchQuery: string;
  selectedType: string;
  selectedPriority: string;
  selectedTag: string;
  selectedAssignee: string;
}

export default function Board({
  items,
  columns,
  tags,
  assignees,
  onMoveItem,
  onEditItem,
  onAddItem,
  searchQuery,
  selectedType,
  selectedPriority,
  selectedTag,
  selectedAssignee,
}: BoardProps) {
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);

  // Filter items matching selected filters
  const filteredItems = items.filter((item) => {
    // 1. Search Query mapping
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = item.title.toLowerCase().includes(q);
      const matchesDesc = item.description.toLowerCase().includes(q);
      const matchesId = item.id.toLowerCase().includes(q);
      if (!matchesTitle && !matchesDesc && !matchesId) return false;
    }

    // 2. Type matching
    if (selectedType && item.type !== selectedType) return false;

    // 3. Priority matching
    if (selectedPriority && item.priority !== selectedPriority) return false;

    // 4. Assignee matching
    if (selectedAssignee && item.assigneeId !== selectedAssignee) return false;

    // 5. Custom Tag matching
    if (selectedTag && !item.tags.includes(selectedTag)) return false;

    return true;
  });

  // Drag & drop handlers for Column Containers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDraggedColumnId(columnId);
  };

  const handleDragLeave = () => {
    setDraggedColumnId(null);
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDraggedColumnId(null);
    const itemId = e.dataTransfer.getData("text/plain");
    if (itemId) {
      onMoveItem(itemId, columnId);
    }
  };

  return (
    <div 
      id="kanban-board-scroller" 
      className="flex gap-5 overflow-x-auto pb-6 pt-2 select-none scrollbar-thin snap-x snap-mandatory font-sans"
    >
      {columns.map((col) => {
        const columnItems = filteredItems.filter((i) => i.status === col.id);
        const columnPoints = columnItems.reduce((acc, curr) => acc + (curr.storyPoints || 0), 0);
        const isTarget = draggedColumnId === col.id;

        return (
          <div
            id={`column-container-${col.id}`}
            key={col.id}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
            className={`flex-1 min-w-[285px] max-w-[350px] snap-always snap-start shrink-0 flex flex-col rounded-2xl border transition-all duration-200 ${
              isTarget 
                ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50 shadow-sm" 
                : "bg-slate-50/40 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/50 shadow-xs"
            }`}
          >
            {/* Column Header */}
            <div className={`p-4 border-b border-slate-150/60 dark:border-slate-800/60 rounded-t-2xl flex items-center justify-between col-head bg-white dark:bg-[#151b2b]`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`px-2.5 py-1 text-[11px] font-display font-extrabold tracking-wider uppercase rounded-lg border-0 bg-slate-100/60 dark:bg-slate-800/60 ${col.textClass}`}>
                  {col.title}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-bold font-mono bg-slate-100/60 dark:bg-slate-800/60 px-2 py-0.5 rounded-full">
                  {columnItems.length}
                </span>
              </div>
              
              <div className="flex items-center gap-1.5">
                {columnPoints > 0 && (
                  <span className="text-[10px] font-bold font-mono text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/40 px-2 py-0.5 rounded-lg">
                    {columnPoints} PT
                  </span>
                )}
                <button
                  id={`btn-add-ticket-${col.id}`}
                  onClick={() => onAddItem(col.id)}
                  className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 bg-white dark:bg-[#151b2b] rounded-lg border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                  title={`Add ticket to ${col.title}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Column Container Body */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3.5 min-h-[450px]">
              {columnItems.map((item) => (
                <Card
                  key={item.id}
                  item={item}
                  tags={tags}
                  assignee={assignees.find((a) => a.id === item.assigneeId)}
                  onEditItem={onEditItem}
                  onMoveItem={onMoveItem}
                  columnsList={columns.map(c => ({ id: c.id, title: c.title }))}
                />
              ))}

              {columnItems.length === 0 && (
                <div className="h-44 border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20 rounded-xl flex flex-col items-center justify-center p-4 text-center text-slate-400 dark:text-slate-600">
                  <span className="text-xs font-bold font-mono text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-1">Queue Empty</span>
                  <p className="text-[10px] leading-relaxed max-w-[170px] text-slate-400 dark:text-slate-600">
                    Drag items here or click "+" to draft details.
                  </p>
                </div>
              )}
            </div>
            
            {/* Quick footer helper */}
            <div className="p-2 border-t border-slate-150/60 dark:border-slate-800/60 text-center bg-white dark:bg-[#151b2b] rounded-b-2xl">
              <button
                id={`btn-col-bottom-add-${col.id}`}
                onClick={() => onAddItem(col.id)}
                className="w-full py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50/65 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl border-0 transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                CREATE TICKET
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
