import React, { useState } from "react";
import { BoardItem, Tag, Assignee, ItemType, Priority, SubTask, ActivityLog } from "../types";
import { 
  X, 
  Plus, 
  Trash, 
  Clock, 
  User, 
  Tag as TagIcon, 
  Activity, 
  Check, 
  MessageSquare,
  Sparkles,
  Bug,
  AlertTriangle,
  CheckSquare,
  PlusCircle,
  Hash,
  Upload,
  Image as ImageIcon
} from "lucide-react";

interface ItemModalProps {
  item?: BoardItem; // if undefined, we are in "Create New" mode
  tags: Tag[];
  assignees: Assignee[];
  columns: { id: string; title: string }[];
  defaultColumnId?: string;
  onClose: () => void;
  onSave: (item: BoardItem) => void;
  onDelete?: (id: string) => void;
  currentUser: string;
}

export default function ItemModal({
  item,
  tags,
  assignees,
  columns,
  defaultColumnId,
  onClose,
  onSave,
  onDelete,
  currentUser
}: ItemModalProps) {
  // Local form state
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [type, setType] = useState<ItemType>(item?.type || ItemType.TASK);
  const [priority, setPriority] = useState<Priority>(item?.priority || Priority.MEDIUM);
  const [status, setStatus] = useState(item?.status || defaultColumnId || columns[0]?.id || "todo");
  const [assigneeId, setAssigneeId] = useState(item?.assigneeId || "");
  const [storyPoints, setStoryPoints] = useState<number>(item?.storyPoints || 0);
  const [dueDate, setDueDate] = useState(item?.dueDate || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(item?.tags || []);
  const [subtasks, setSubtasks] = useState<SubTask[]>(item?.subtasks || []);
  const [history, setHistory] = useState<ActivityLog[]>(item?.history || []);
  
  // Image attachments states
  const [images, setImages] = useState<string[]>(item?.images || []);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setImages((prev) => [...prev, dataUrl]);
        logActivity(`Uploaded image attachment: "${file.name}"`);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach(processFile);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(processFile);
    }
  };

  const removeImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    logActivity(`Deleted an image attachment`);
  };
  
  // Interactive mini states
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newComment, setNewComment] = useState("");
  const [showTagCreator, setShowTagCreator] = useState(false);

  // Toggle custom tags
  const handleToggleTag = (tagId: string) => {
    setSelectedTags((prev) => 
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  // Add subtask
  const handleAddSubtask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    const newSub: SubTask = {
      id: `sub-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };

    setSubtasks([...subtasks, newSub]);
    setNewSubtaskTitle("");

    // Log action
    logActivity(`Added subtask "${newSub.title}"`);
  };

  // Toggle subtask status
  const handleToggleSubtask = (id: string) => {
    setSubtasks(subtasks.map(sub => {
      if (sub.id === id) {
        const nextState = !sub.completed;
        logActivity(`${nextState ? 'Completed' : 'Reopened'} subtask "${sub.title}"`);
        return { ...sub, completed: nextState };
      }
      return sub;
    }));
  };

  // Delete subtask
  const handleDeleteSubtask = (id: string, subTitle: string) => {
    setSubtasks(subtasks.filter(sub => sub.id !== id));
    logActivity(`Deleted subtask "${subTitle}"`);
  };

  // Add Comment/Note to history log
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    logActivity(`Developer Comment: "${newComment.trim()}"`);
    setNewComment("");
  };

  // Helper code to log history item
  const logActivity = (actionText: string) => {
    const newLog: ActivityLog = {
      id: `hist-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: currentUser,
      action: actionText,
    };
    setHistory([newLog, ...history]);
  };

  // Pre-save validations & submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Detect changes in fields to add automated logs
    const auditLogs: ActivityLog[] = [...history];

    const generateAudit = (field: string, oldVal: string, newVal: string) => {
      if (oldVal !== newVal) {
        auditLogs.unshift({
          id: `hist-audit-${Date.now()}-${Math.random()}`,
          timestamp: new Date().toISOString(),
          user: currentUser,
          action: `Changed ${field} from "${oldVal || 'None'}" to "${newVal || 'None'}"`,
        });
      }
    };

    if (item) {
      generateAudit("Title", item.title, title);
      generateAudit("Type", item.type, type);
      generateAudit("Priority", item.priority, priority);
      generateAudit("Status", item.status, status);
      
      const getAssigneeName = (id: string) => assignees.find(a => a.id === id)?.name || "Unassigned";
      generateAudit("Assignee", getAssigneeName(item.assigneeId || ""), getAssigneeName(assigneeId));
    } else {
      // New item creation log
      auditLogs.push({
        id: `hist-create-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user: currentUser,
        action: "Created issue ticket on development flow standard template",
      });
    }

    const savedItem: BoardItem = {
      id: item?.id || `item-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      type,
      priority,
      status,
      assigneeId: assigneeId || undefined,
      storyPoints: storyPoints > 0 ? storyPoints : undefined,
      dueDate: dueDate || undefined,
      tags: selectedTags,
      subtasks,
      history: auditLogs,
      createdDate: item?.createdDate || new Date().toISOString(),
      images: images,
    };

    onSave(savedItem);
  };

  return (
    <div id="item-modal-overlay" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs overflow-y-auto font-sans">
      <div 
        id="item-modal-container"
        className="relative w-full max-w-3xl bg-white dark:bg-[#151b2b] sm:rounded-2xl shadow-geom-lg border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in slide-in-from-bottom-4 duration-300"
      >
        {/* Modal Title Banner */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Hash className="w-4 h-4 md:w-5 md:h-5" />
            </span>
            <div>
              <h3 className="text-xs md:text-sm font-display font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                {item ? "Inspect Ticket" : "New Ticket"}
              </h3>
              <p className="text-[9px] md:text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium uppercase mt-0.5">
                {item ? `ID: ${item.id}` : "Configure parameters"}
              </p>
            </div>
          </div>
          <button 
            id="close-modal-x"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-all cursor-pointer bg-white dark:bg-[#151b2b]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 md:space-y-6">
          
          {/* Main Title Input */}
          <div className="space-y-1.5">
            <label htmlFor="ticket-title-input" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono block">
              Ticket Name
            </label>
            <input 
              id="ticket-title-input"
              type="text" 
              required
              placeholder="e.g., Fix database isolation transaction levels"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left side parameters (Type, Priority, Column, Assignee, Points, Due Date) */}
            <div className="md:col-span-2 space-y-5">
              
              {/* Description Textarea */}
              <div className="space-y-1.5">
                <label htmlFor="ticket-description" className="text-[10px] font-black text-slate-905 dark:text-slate-300 uppercase tracking-widest font-mono block">
                  Description
                </label>
                <textarea 
                  id="ticket-description"
                  rows={4}
                  placeholder="Provide brief engineering guidelines, logs format details, and steps to replicate."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-md p-4 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 resize-y font-sans leading-relaxed"
                />
              </div>

              {/* Image Attachments Drag-and-Drop Dropzone & Click-to-Upload Selector */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono block">
                  IMAGE ATTACHMENTS
                </span>
                
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
                  onDragEnter={(e) => { e.preventDefault(); setIsDragActive(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false); }}
                  onDrop={handleImageDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border border-dashed p-4 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragActive 
                      ? "border-indigo-500 bg-indigo-50/20 dark:bg-indigo-900/20" 
                      : "border-slate-200 dark:border-slate-700 bg-slate-50/20 dark:bg-slate-900/20 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-350 dark:hover:border-slate-600"
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*" 
                    multiple 
                    className="hidden" 
                  />
                  <Upload className="w-6 h-6 text-slate-400 dark:text-slate-500 mb-1.5" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Drag & drop images here, or <span className="text-indigo-650 dark:text-indigo-400 font-bold hover:underline">browse</span></span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">Lightweight optimised snapshots (JPG, PNG, GIF)</span>
                </div>

                {/* Thumbnail Preview Area */}
                {images.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-2 font-mono">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative group/img aspect-video rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shadow-sm">
                        <img src={img} alt="Attachment thumbnail" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                          className="absolute top-1 right-1 p-1 bg-slate-900/60 hover:bg-rose-600 rounded-full text-white transition-colors cursor-pointer"
                          title="Prune image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Grid Details (Status, Assignee, Points, DueDate) */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* Column Selection Status */}
                <div className="space-y-1">
                  <label htmlFor="column-select" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono block">COLUMN STATUS</label>
                  <select
                    id="column-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-400 dark:focus:border-indigo-500 font-semibold cursor-pointer transition-all"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>{col.title}</option>
                    ))}
                  </select>
                </div>

                {/* Team Assignee Picker */}
                <div className="space-y-1">
                  <label htmlFor="assignee-select" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono block">TEAM ASSIGNEE</label>
                  <select
                    id="assignee-select"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-400 dark:focus:border-indigo-500 font-semibold cursor-pointer transition-all"
                  >
                    <option value="">Unassigned</option>
                    {assignees.map((as) => (
                      <option key={as.id} value={as.id}>
                        {as.name} ({as.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Estimate Points */}
                <div className="space-y-1">
                  <label htmlFor="points-input" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono block">STORY ESTIMATES (PT)</label>
                  <input
                    id="points-input"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 1, 3, 5, 8"
                    value={storyPoints === 0 ? "" : storyPoints}
                    onChange={(e) => setStoryPoints(Number(e.target.value))}
                    className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-400 dark:focus:border-indigo-500 font-bold transition-all"
                  />
                </div>

                {/* Due Date Indicator */}
                <div className="space-y-1">
                  <label htmlFor="due-date-input" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono block">TARGET DEADLINE</label>
                  <input
                    id="due-date-input"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl p-2.5 text-xs outline-none focus:border-indigo-400 dark:focus:border-indigo-500 font-mono font-bold transition-all"
                  />
                </div>

              </div>

              {/* Subtasks Section */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono block">
                  SUBTASKS INTEGRATION
                </span>

                {/* Checklist implementation */}
                {subtasks.length > 0 && (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {subtasks.map((sub) => (
                      <div 
                        key={sub.id} 
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800 transition-all duration-150 shadow-xs"
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1">
                          <input 
                            type="checkbox" 
                            checked={sub.completed}
                            onChange={() => handleToggleSubtask(sub.id)}
                            className="w-4 h-4 rounded text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 focus:ring-indigo-500 outline-none"
                          />
                          <span className={`text-xs text-slate-700 dark:text-slate-300 truncate font-semibold font-mono ${sub.completed ? "line-through text-slate-400 dark:text-slate-600 decoration-slate-400 dark:decoration-slate-600" : ""}`}>
                            {sub.title}
                          </span>
                        </label>
                        <button 
                          type="button" 
                          onClick={() => handleDeleteSubtask(sub.id, sub.title)}
                          className="p-1 px-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#1e293b] transition-all cursor-pointer"
                          title="Prune task"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Subtask additions controls */}
                <div className="flex gap-2">
                  <input
                    title="Add Subtask Title"
                    type="text"
                    placeholder="Describe specific development milestone subtask..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubtask();
                      }
                    }}
                    className="flex-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-xs rounded-xl p-2.5 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 font-semibold placeholder-slate-400 dark:placeholder-slate-600 text-slate-700 dark:text-slate-300 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddSubtask()}
                    className="px-4 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 hover:text-white dark:hover:text-white text-slate-700 dark:text-slate-300 rounded-xl border border-slate-250 dark:border-slate-700 transition-all font-mono font-bold text-xs uppercase flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>

            </div>

            {/* Right side parameters (Type, Priority, Custom Tags list, and Logs) */}
            <div className="space-y-5">
              
              {/* Item Type Picker */}
              <div className="space-y-1.5 font-sans">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono block">FLOW ENTRY TYPE</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { type: ItemType.TASK, label: "Task", icon: <CheckSquare className="w-3.5 h-3.5" /> },
                    { type: ItemType.BUG, label: "Bug", icon: <Bug className="w-3.5 h-3.5 font-bold" /> },
                    { type: ItemType.ERROR, label: "Error", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
                    { type: ItemType.FEATURE, label: "Feature", icon: <Sparkles className="w-3.5 h-3.5" /> },
                  ].map((entry) => {
                    const active = type === entry.type;
                    return (
                      <button
                        type="button"
                        key={entry.type}
                        onClick={() => setType(entry.type)}
                        className={`flex items-center gap-1.5 p-2.5 rounded-xl border text-xs font-mono font-bold uppercase tracking-wider transition-all ${
                          active 
                            ? "bg-slate-900 dark:bg-indigo-600 text-white border-slate-900 dark:border-indigo-600 shadow-xs" 
                            : "bg-white dark:bg-[#1e293b] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        }`}
                      >
                        {entry.icon}
                        {entry.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority level options */}
              <div className="space-y-1.5 font-sans">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono block">CRITICAL PRIORITY LEVEL</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { priority: Priority.URGENT, label: "Urgent", color: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/50" },
                    { priority: Priority.HIGH, label: "High", color: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/50" },
                    { priority: Priority.MEDIUM, label: "Medium", color: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50" },
                    { priority: Priority.LOW, label: "Low", color: "bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700" },
                  ].map((level) => {
                    const active = priority === level.priority;
                    return (
                      <button
                        type="button"
                        key={level.priority}
                        onClick={() => setPriority(level.priority)}
                        className={`p-2.5 rounded-xl border text-xs font-mono font-bold uppercase tracking-wider text-center transition-all ${
                          active 
                            ? `${level.color} shadow-xs font-black` 
                            : "bg-white dark:bg-[#1e293b] text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        }`}
                      >
                        {level.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Tags Checklist */}
              <div className="space-y-2 font-sans">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono block">TICKET TAGS</span>
                
                <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 max-h-[140px] overflow-y-auto">
                  {tags.map((tg) => {
                    const checked = selectedTags.includes(tg.id);
                    return (
                      <button
                        type="button"
                        key={tg.id}
                        onClick={() => handleToggleTag(tg.id)}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] uppercase font-bold tracking-wider transition-all ${
                          checked 
                            ? `${tg.bgClass} border-slate-350 dark:border-slate-700 shadow-xs font-black` 
                            : "bg-white dark:bg-[#1e293b] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        }`}
                      >
                        {tg.name}
                      </button>
                    );
                  })}
                  {tags.length === 0 && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide font-mono italic">No custom tags created</span>
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* Comment Stream Log Panel */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4 font-sans">
            <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-slate-500" />
              Activity Stream & Discussion Log
            </h4>

            {/* Comment adding box */}
            <div className="flex gap-2.5 items-start bg-slate-50/50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-xs">
              <div className="w-7 h-7 bg-indigo-600 text-white font-mono font-bold rounded-lg text-[10px] flex items-center justify-center shrink-0 animate-pulse">
                {currentUser.split(" ").map(w => w[0]).join("")}
              </div>
              <div className="flex-1 space-y-2">
                <textarea
                  title="Comment field"
                  rows={2}
                  placeholder="Insert review notes, error updates, or developer guidelines here..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 resize-none font-medium placeholder-slate-400 dark:placeholder-slate-600 transition-all font-sans"
                />
                <div className="flex justify-end font-sans">
                  <button
                    type="button"
                    onClick={handleAddComment}
                    className="px-3.5 py-1.5 bg-slate-800 dark:bg-indigo-600 hover:bg-slate-900 dark:hover:bg-indigo-700 text-white rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Submit Comment
                  </button>
                </div>
              </div>
            </div>

            {/* History Feed List */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {history.map((log) => (
                <div 
                  key={log.id} 
                  className="p-3 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/20 dark:bg-slate-900/40 text-xs flex items-start gap-2.5 font-mono shadow-xs"
                >
                  <div className="p-1 px-1.5 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded text-[9px] font-bold text-slate-500 dark:text-slate-400 font-mono shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-slate-800 dark:text-slate-100 mr-1.5 uppercase">{log.user}</span>
                    <span className="text-slate-600 dark:text-slate-400 font-sans leading-relaxed break-words font-medium">{log.action}</span>
                  </div>
                </div>
              ))}
              {history.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-600 font-bold uppercase tracking-wide font-mono italic text-center p-4">No logged history actions found for this ticket yet.</p>
              )}
            </div>

          </div>

        </form>

        {/* Footer actions */}
        <div className="px-4 md:px-6 py-4 bg-slate-50/50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex justify-center md:justify-start">
            {item && onDelete && (
              <button
                id="btn-delete-ticket"
                type="button"
                onClick={() => {
                  if (confirm("Are you absolutely sure you want to delete this development flow ticket? This cannot be undone.")) {
                    onDelete(item.id);
                  }
                }}
                className="w-full md:w-auto px-4 py-2 text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-500 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-[#151b2b] text-[10px] md:text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Trash className="w-3.5 md:w-4 h-3.5 md:h-4" />
                Delete
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-cancel"
              type="button"
              onClick={onClose}
              className="flex-1 md:flex-none px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl text-[10px] md:text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-save"
              onClick={handleSubmit}
              className="flex-[2] md:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] md:text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer border-0"
            >
              <Check className="w-3.5 md:w-4 h-3.5 md:h-4" />
              {item ? "Apply Changes" : "Commit Ticket"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
