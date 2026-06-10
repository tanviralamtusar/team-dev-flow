import React, { useState } from "react";
import { BoardItem, Column, Assignee, ItemType, Priority } from "../types";
import { 
  BarChart, 
  Layers, 
  AlertOctagon, 
  CheckCircle2, 
  FileText, 
  PieChart as PieIcon, 
  Users, 
  TrendingUp, 
  Flame 
} from "lucide-react";

interface StatsViewProps {
  items: BoardItem[];
  columns: Column[];
  assignees: Assignee[];
  onSelectFilter: (filterType: "type" | "priority" | "status" | "assignee", value: string) => void;
}

export default function StatsView({ items, columns, assignees, onSelectFilter }: StatsViewProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  // Key stats Calculations
  const totalItems = items.length;
  const bugsCount = items.filter((i) => i.type === ItemType.BUG).length;
  const errorsCount = items.filter((i) => i.type === ItemType.ERROR).length;
  const tasksCount = items.filter((i) => i.type === ItemType.TASK).length;
  const featuresCount = items.filter((i) => i.type === ItemType.FEATURE).length;

  const urgentCount = items.filter((i) => i.priority === Priority.URGENT).length;
  const highCount = items.filter((i) => i.priority === Priority.HIGH).length;

  const doneCount = items.filter((i) => i.status === "done").length;
  const activeCount = items.filter((i) => i.status === "in_progress" || i.status === "in_review").length;

  const totalPoints = items.reduce((sum, item) => sum + (item.storyPoints || 0), 0);
  const completedPoints = items
    .filter((i) => i.status === "done")
    .reduce((sum, item) => sum + (item.storyPoints || 0), 0);

  const completionPercent = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0;
  const pointsCompletionPercent = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

  // Group by Assignee (Workload)
  const assigneeWorkload = assignees.map((assignee) => {
    const assignedItems = items.filter((i) => i.assigneeId === assignee.id);
    const unresolvedItems = assignedItems.filter((i) => i.status !== "done");
    const totalStoryPoints = assignedItems.reduce((acc, current) => acc + (current.storyPoints || 0), 0);
    return {
      assignee,
      count: assignedItems.length,
      unresolved: unresolvedItems.length,
      points: totalStoryPoints,
    };
  });

  // Calculate workloads
  const maxPoints = Math.max(...assigneeWorkload.map((w) => w.points), 1);

  // Status distribution percentages
  const statusValues = columns.map(col => {
    const count = items.filter(i => i.status === col.id).length;
    return {
      ...col,
      count,
      percent: totalItems > 0 ? Math.round((count / totalItems) * 100) : 0
    };
  });

  return (
    <div id="stats-dashboard" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-xs">
        <div>
          <h2 className="text-lg font-display font-medium text-slate-950 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Core Delivery Metrics
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-0.5">
            Real-time telemetry showing workload delivery rate, bug statistics, and team velocity indicators.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100/80 dark:border-slate-800 px-4 py-2 rounded-xl">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-mono uppercase tracking-widest font-extrabold">DELIVERY SCORE</span>
            <span className="text-lg font-display font-bold text-emerald-600 dark:text-emerald-500 block leading-none mt-0.5">{completionPercent}%</span>
          </div>
          <div className="w-12 h-12 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-emerald-700 relative">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100 dark:text-slate-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500"
                strokeDasharray={`${completionPercent}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-[9px] font-mono font-bold text-slate-900 dark:text-slate-100">ST</span>
          </div>
        </div>
      </div>

      {/* Grid Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Board Cards */}
        <div className="bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-slate-800 p-5 rounded-2xl relative overflow-hidden shadow-xs hover:shadow-sm transition-all group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold tracking-wider font-mono uppercase block">TOTAL ITEMS</span>
              <span className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-1 block">{totalItems}</span>
            </div>
            <div className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-800 rounded-xl group-hover:bg-slate-900 dark:group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-3 flex items-center gap-1 font-sans">
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{activeCount} active</span> running items
          </p>
        </div>

        {/* Total Bugs */}
        <div 
          onClick={() => onSelectFilter("type", ItemType.BUG)}
          className="bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-slate-800 p-5 rounded-2xl relative overflow-hidden shadow-xs hover:shadow-sm cursor-pointer transition-all group"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-rose-500 text-[10px] font-bold tracking-wider font-mono uppercase block">ACTIVE BUGS</span>
              <span className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-1 block">{bugsCount}</span>
            </div>
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-slate-100 dark:border-slate-800 text-rose-600 dark:text-rose-400 rounded group-hover:bg-slate-900 dark:group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-3 flex items-center gap-1 font-sans">
            <span className="font-bold text-rose-600 dark:text-rose-400">{items.filter(i => i.type === ItemType.BUG && i.status !== "done").length} unresolved</span> defects
          </p>
        </div>

        {/* Server Errors Influx */}
        <div 
          onClick={() => onSelectFilter("type", ItemType.ERROR)}
          className="bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-slate-800 p-5 rounded-2xl relative overflow-hidden shadow-xs hover:shadow-sm cursor-pointer transition-all group"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-amber-600 dark:text-amber-500 text-[10px] font-bold tracking-wider font-mono uppercase block">CRASH ALERTS</span>
              <span className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-1 block">{errorsCount}</span>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-slate-100 dark:border-slate-800 text-amber-600 dark:text-amber-400 rounded group-hover:bg-slate-900 dark:group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-3 flex items-center gap-1 font-sans">
            <span className="font-bold text-amber-600 dark:text-amber-400">{urgentCount} critical urgent</span> failures
          </p>
        </div>

        {/* Story points velocity */}
        <div className="bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-slate-800 p-5 rounded-2xl relative overflow-hidden shadow-xs hover:shadow-sm transition-all group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold tracking-wider font-mono uppercase block">STORY VELOCITY</span>
              <span className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-1 block">
                {completedPoints}<span className="text-slate-400 dark:text-slate-500 text-xs font-mono font-bold">/{totalPoints}PT</span>
              </span>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-slate-100 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 rounded group-hover:bg-slate-900 dark:group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-3 flex items-center gap-1 font-sans">
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{pointsCompletionPercent}% completion</span> volume
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Type & Status Ratios */}
        <div className="lg:col-span-8 space-y-6">
          
           {/* Workload Status Distribution Bar */}
          <div className="bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-xs">
            <h3 className="text-xs font-display font-medium text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              Column Status Dispersion
            </h3>
            
            <div className="space-y-4">
              {/* Stacked Percentage bar */}
              <div className="h-4 w-full rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden flex shadow-xs">
                {statusValues.map((val, idx) => {
                  if (val.count === 0) return null;
                  const bgColors = [
                    "bg-slate-300 dark:bg-slate-600",  // backlog
                    "bg-blue-400 dark:bg-blue-600",   // todo
                    "bg-amber-400 dark:bg-amber-600",  // in_progress
                    "bg-purple-400 dark:bg-purple-600",  // in_review (purple)
                    "bg-emerald-400 dark:bg-emerald-600", // done
                  ];
                  return (
                    <div 
                      key={val.id} 
                      className={`${bgColors[idx % bgColors.length]} h-full transition-all duration-500 relative group cursor-pointer`}
                      style={{ width: `${val.percent}%` }}
                      title={`${val.title}: ${val.count} items (${val.percent}%)`}
                      onClick={() => onSelectFilter("status", val.id)}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                        {val.percent}%
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Status breakdown legend list */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-2">
                {statusValues.map((val, idx) => {
                  const borderColors = [
                    "border-l-slate-300 dark:border-l-slate-600",
                    "border-l-blue-400 dark:border-l-blue-600",
                    "border-l-amber-400 dark:border-l-amber-600",
                    "border-l-purple-400 dark:border-l-purple-600",
                    "border-l-emerald-400 dark:border-l-emerald-600",
                  ];

                  return (
                    <div 
                      key={val.id} 
                      onClick={() => onSelectFilter("status", val.id)}
                      className={`p-3 rounded-xl border border-slate-100 dark:border-slate-800 border-l-4 ${borderColors[idx]} bg-slate-50/50 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800 transition-all duration-150 cursor-pointer shadow-xs`}
                    >
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block truncate tracking-wider uppercase font-mono">{val.title}</span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-lg font-display font-medium text-slate-900 dark:text-slate-100">{val.count}</span>
                        <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500">({val.percent}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Workflow Distribution Categories (Bugs, Tasks, etc) */}
          <div className="bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-xs">
            <h3 className="text-xs font-display font-medium text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              Workflow Dispersal By Type
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[
                { type: ItemType.TASK, label: "Developer Tasks", count: tasksCount, color: "indigo", desc: "Configuration & standard implementation" },
                { type: ItemType.BUG, label: "Reported Defects", count: bugsCount, color: "rose", desc: "Regressions and manual/QA ticket reports" },
                { type: ItemType.ERROR, label: "Core Fault Logs", count: errorsCount, color: "amber", desc: "Automated production crash exceptions" },
                { type: ItemType.FEATURE, label: "Feature Requests", count: featuresCount, color: "emerald", desc: "Upstream product enhancements" },
              ].map((cat) => {
                const colorMap: Record<string, { bg: string, text: string, hover: string }> = {
                  indigo: { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-700 dark:text-indigo-400", hover: "hover:border-indigo-400 dark:hover:border-indigo-500" },
                  rose: { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-700 dark:text-rose-400", hover: "hover:border-rose-400 dark:hover:border-rose-500" },
                  amber: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-700 dark:text-amber-400", hover: "hover:border-amber-400 dark:hover:border-amber-500" },
                  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-400", hover: "hover:border-emerald-400 dark:hover:border-emerald-500" },
                };
                const style = colorMap[cat.color];

                return (
                  <div 
                    key={cat.type}
                    onClick={() => onSelectFilter("type", cat.type)}
                    className={`p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-all duration-150 flex flex-col justify-between shadow-xs hover:shadow-sm ${style.hover}`}
                  >
                    <div>
                      <span className={`inline-block px-2.5 py-0.5 ${style.bg} ${style.text} rounded-lg text-[9px] font-bold font-mono tracking-wider uppercase mb-2`}>
                        {cat.type}
                      </span>
                      <p className="text-[11px] text-slate-400 dark:text-slate-400 leading-snug">{cat.desc}</p>
                    </div>
                    <div className="flex items-baseline gap-2 mt-4">
                      <span className="text-2xl font-display font-black text-slate-900 dark:text-slate-100">{cat.count}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-bold">
                        ({totalItems > 0 ? Math.round((cat.count / totalItems) * 105 / 1.05) : 0}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right column: Teammate Workload and Story Load */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-slate-800 p-6 rounded-2xl h-full flex flex-col shadow-xs">
            <h3 className="text-xs font-display font-medium text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              Dev Workload Loading
            </h3>

            <div className="space-y-4 flex-1">
              {assigneeWorkload.map(({ assignee, count, unresolved, points }) => {
                const percentPoints = Math.round((points / maxPoints) * 100);

                return (
                  <div 
                    key={assignee.id} 
                    onClick={() => onSelectFilter("assignee", assignee.id)}
                    className="p-3 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors duration-150 cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-xl border border-transparent flex items-center justify-center font-bold text-xs ${assignee.avatarColor}`}>
                          {assignee.name.split(" ").map(w => w[0]).join("")}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block leading-tight">{assignee.name}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium block">{assignee.role}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block font-mono">{points} PTS</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 block font-mono font-semibold">{unresolved} open items</span>
                      </div>
                    </div>

                    {/* Workload Progress Bar */}
                    <div className="space-y-1">
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500"
                          style={{ width: `${percentPoints}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 font-mono font-bold uppercase tracking-wider">
                        <span>Load velocity</span>
                        <span>{percentPoints}% capacity</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-indigo-50/30 dark:bg-indigo-950/20 p-4 border border-indigo-100/50 dark:border-indigo-800/50 rounded-xl mt-6 text-xs text-indigo-950 dark:text-indigo-200 font-medium shadow-xs">
              <span className="font-display font-medium flex items-center gap-1.5 mb-1 text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Planning Suggestion
              </span>
              Assign story points to team items inside the board cards. Active charts compute individual developer workloads based on assigned story points logic.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
