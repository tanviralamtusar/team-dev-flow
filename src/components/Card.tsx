import React from "react";
import { BoardItem, Tag, Assignee, ItemType, Priority } from "../types";
import { 
  Bug, 
  AlertTriangle, 
  Sparkles, 
  CheckSquare, 
  Calendar, 
  Clock, 
  Layers, 
  CheckCircle2, 
  ChevronRight,
  ExternalLink
} from "lucide-react";

interface CardProps {
  key?: string;
  item: BoardItem;
  tags: Tag[];
  assignee?: Assignee;
  onEditItem: (id: string) => void;
  onMoveItem: (id: string, newStatus: string) => void;
  columnsList: { id: string; title: string }[];
}

export default function Card({ item, tags, assignee, onEditItem, onMoveItem, columnsList }: CardProps) {
  // Select matching tag configurations
  const itemTags = tags.filter((t) => item.tags.includes(t.id));

  // Determine priority color configuration
  const getPriorityInfo = (pri: Priority) => {
    switch (pri) {
      case Priority.URGENT:
        return { 
          bg: "bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 font-bold", 
          dot: "bg-rose-600 dark:bg-rose-500 animate-pulse",
          label: "Urgent" 
        };
      case Priority.HIGH:
        return { 
          bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 font-bold", 
          dot: "bg-amber-500 dark:bg-amber-500",
          label: "High" 
        };
      case Priority.MEDIUM:
        return { 
          bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-400 font-medium", 
          dot: "bg-blue-500 dark:bg-blue-500",
          label: "Medium" 
        };
      case Priority.LOW:
        return { 
          bg: "bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 font-medium", 
          dot: "bg-slate-400 dark:bg-slate-500",
          label: "Low" 
        };
    }
  };

  // Determine type styling configuration
  const getTypeInfo = (type: ItemType) => {
    switch (type) {
      case ItemType.BUG:
        return {
          icon: <Bug className="w-3.5 h-3.5 text-rose-500" />,
          bg: "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/40",
          border: "border-t-rose-500",
          label: "BUG"
        };
      case ItemType.ERROR:
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-red-500" />,
          bg: "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/40",
          border: "border-t-red-500",
          label: "CRASH"
        };
      case ItemType.TASK:
        return {
          icon: <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />,
          bg: "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/40",
          border: "border-t-indigo-500",
          label: "TASK"
        };
      case ItemType.FEATURE:
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-emerald-500" />,
          bg: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40",
          border: "border-t-emerald-500",
          label: "FEATURE"
        };
    }
  };

  const priorityStyle = getPriorityInfo(item.priority);
  const typeStyle = getTypeInfo(item.type);

  // Subtask calculations
  const totalSubtasks = item.subtasks.length;
  const completedSubtasks = item.subtasks.filter((s) => s.completed).length;
  const subtasksPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", item.id);
    e.dataTransfer.effectAllowed = "move";
  };

  // Analyze if target date is near / past due
  const getDueDateStatus = (dueDate?: string) => {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dueDate);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (item.status === "done") {
      return { text: dueDate, style: "bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-500" };
    }
    if (diffDays < 0) {
      return { text: `Overdue (${Math.abs(diffDays)}d)`, style: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/50 animate-pulse font-semibold" };
    }
    if (diffDays <= 2) {
      return { text: `Due in ${diffDays}d`, style: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/50 font-medium" };
    }
    return { text: dueDate, style: "bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400" };
  };

  const dueInfo = getDueDateStatus(item.dueDate);

  return (
    <div
      id={`card-${item.id}`}
      draggable
      onDragStart={handleDragStart}
      onDoubleClick={() => onEditItem(item.id)}
      className={`group bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-slate-800 border-t-[5px] ${typeStyle.border} p-4 rounded-xl shadow-xs hover:shadow-md hover:scale-[1.005] hover:border-slate-200/80 dark:hover:border-slate-700 transition-all duration-200 cursor-grab active:cursor-grabbing relative flex flex-col justify-between font-sans`}
    >
      <div>
        {/* Header containing Type & Priority */}
        <div className="flex items-center justify-between gap-1 mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wider font-mono border border-transparent uppercase truncate ${typeStyle.bg}`}>
              {typeStyle.icon}
              {typeStyle.label}
            </span>
          </div>

          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-bold font-mono border border-transparent ${priorityStyle.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
            {priorityStyle.label}
          </span>
        </div>

        {/* Attached image preview */}
        {item.images && item.images.length > 0 && (
          <div className="w-full aspect-[2/1] rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 mb-2.5 cursor-pointer" onClick={() => onEditItem(item.id)}>
            <img src={item.images[0]} alt="Board attachment" className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300" referrerPolicy="no-referrer" />
          </div>
        )}

        {/* Card Title */}
        <h4 
          onClick={() => onEditItem(item.id)}
          className="text-sm font-display font-bold text-slate-800 dark:text-slate-100 leading-snug tracking-tight hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
        >
          {item.title}
        </h4>

        {/* Card Description Truncated */}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
          {item.description}
        </p>

        {/* Tags Row */}
        {itemTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {itemTags.map((t) => (
              <span 
                key={t.id} 
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border border-transparent ${t.bgClass}`}
              >
                {t.name}
              </span>
            ))}
          </div>
        )}

        {/* Subtasks Progress */}
        {totalSubtasks > 0 && (
          <div className="mt-3.5 space-y-1.5 bg-slate-50/30 dark:bg-slate-800/20 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-500 font-bold">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                SUBTASKS
              </span>
              <span>{completedSubtasks}/{totalSubtasks} ({subtasksPercent}%)</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  subtasksPercent === 100 ? "bg-emerald-500" : "bg-indigo-600 dark:bg-indigo-500"
                }`}
                style={{ width: `${subtasksPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Card Footer containing Assignee, Points & Due date */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1">
        {/* Assignee Avatar */}
        <div className="flex items-center gap-1.5 min-w-0">
          {assignee ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <div 
                className={`w-5.5 h-5.5 rounded-md flex items-center justify-center font-bold text-[9px] uppercase shrink-0 text-white shadow-xs ${assignee.avatarColor}`}
                title={`${assignee.name} (${assignee.role})`}
              >
                {assignee.name.split(" ").map(w => w[0]).join("")}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-semibold font-mono" title={assignee.name}>
                {assignee.name.split(" ")[0]}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <div className="w-5.5 h-5.5 rounded-md border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-center text-slate-400 dark:text-slate-600 text-[10px] shrink-0">
                ?
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-600 font-medium italic">Unassigned</span>
            </div>
          )}
        </div>

        {/* Story points and Due Date Info */}
        <div className="flex items-center gap-1.5 shrink-0">
          {item.storyPoints !== undefined && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold font-mono text-slate-500 dark:text-slate-400 border border-slate-150 dark:border-slate-800 shadow-xs">
              {item.storyPoints} PT
            </span>
          )}

          {dueInfo && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] border border-transparent font-mono font-bold ${dueInfo.style}`}>
              <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
              {dueInfo.text.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Manual column shifter trigger for accessibility or mobile touch view */}
      <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity focus-within:opacity-100 flex items-center gap-1">
        <select
          title="Move column"
          value={item.status}
          onChange={(e) => onMoveItem(item.id, e.target.value)}
          className="text-[9px] bg-white/90 dark:bg-[#1e293b]/90 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-0.5 text-slate-500 dark:text-slate-400 focus:border-indigo-400 max-w-[80px] font-mono font-bold outline-none cursor-pointer shadow-sm"
        >
          {columnsList.map(col => (
            <option key={col.id} value={col.id}>{col.title}</option>
          ))}
        </select>
        <button 
          id={`btn-edit-${item.id}`}
          onClick={() => onEditItem(item.id)}
          className="p-1 bg-white/90 dark:bg-[#1e293b]/90 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shadow-sm"
          title="Edit issue Details"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
