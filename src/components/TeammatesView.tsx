import React, { useState } from "react";
import { Assignee } from "../types";
import { 
  Users, 
  Plus, 
  Trash, 
  Briefcase, 
  Mail, 
  RefreshCw
} from "lucide-react";

import * as api from "../api";

interface TeammatesViewProps {
  projectId: string;
  assignees: Assignee[];
  onUpdateAssignees: (assignees: Assignee[]) => void;
}

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

export default function TeammatesView({
  projectId,
  assignees,
  onUpdateAssignees,
}: TeammatesViewProps) {
  
  // Form States
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Handler: Add & Invite Teammate
  const handleAddTeammate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !projectId) return;

    setIsLoading(true);
    try {
      // 1. Send invitation
      await api.sendInvitation(projectId, email.trim()).catch(err => {
        // If they are already a member or invited, we might still want to add them to assignees if missing
        console.warn("Invitation not sent:", err.message);
      });

      // 2. Add to local roster (assignees)
      const profiles = await api.getAllProfiles();
      const existingProfile = profiles.find(p => p.email.toLowerCase() === email.trim().toLowerCase());

      const newMember: Assignee = {
        id: existingProfile ? existingProfile.id : `dev-${Date.now()}`,
        name: existingProfile?.username || email.trim().split('@')[0],
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        role: role.trim() || (existingProfile?.role) || "Developer",
        email: email.trim(),
      };

      // Check if already in assignees
      if (!assignees.some(a => a.email.toLowerCase() === email.trim().toLowerCase())) {
        onUpdateAssignees([...assignees, newMember]);
      } else {
        alert("This teammate is already in your roster.");
      }

      setEmail("");
      setRole("");
    } catch (err: any) {
      alert(err.message || "Failed to add teammate");
    } finally {
      setIsLoading(false);
    }
  };

  // Handler: Delete Teammate
  const handleDeleteMember = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove ${name} from the team? Board items assigned to them will continue to exist but show as unassigned.`)) {
      onUpdateAssignees(assignees.filter((a) => a.id !== id));
    }
  };

  return (
    <div id="teammates-panel" className="max-w-4xl mx-auto animate-fade-in space-y-6">
      
      <div className="bg-white dark:bg-[#151b2b] border border-slate-100 dark:border-slate-800 p-6 rounded-2xl space-y-6 shadow-xs">
        <div>
          <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Development Teammates
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure human assignees to model delivery capabilities and workload stats.
          </p>
        </div>

        {/* Existing team roster */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
          {assignees.map((as) => (
            <div 
              key={as.id} 
              className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs transition-all duration-150"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl border border-transparent flex items-center justify-center font-bold text-sm uppercase shrink-0 ${as.avatarColor}`}>
                  {as.name.split(" ").map(w => w[0]).join("")}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block truncate">{as.name}</span>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono font-semibold uppercase">
                    <span className="flex items-center gap-0.5 truncate max-w-[80px]">
                      <Briefcase className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      {as.role}
                    </span>
                    <span className="flex items-center gap-0.5 truncate max-w-[100px]">
                      <Mail className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      {as.email}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => handleDeleteMember(as.id, as.name)}
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#1e293b] shadow-xs transition-colors cursor-pointer"
                title="Remove Teammate"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Merged Invitation & Provision Form */}
        <form onSubmit={handleAddTeammate} className="bg-slate-50/50 dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-w-2xl mx-auto shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 font-mono tracking-wider uppercase block flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add Teammate to Project
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="member-email" className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold uppercase block px-1">Email Address</label>
              <input
                id="member-email"
                type="email"
                required
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-xs rounded-xl p-3 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 font-medium text-slate-600 dark:text-slate-300 transition-all shadow-xs"
              />
            </div>
            
            <div className="space-y-1.5">
              <label htmlFor="member-role" className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold uppercase block px-1">Designated Role</label>
              <input
                id="member-role"
                type="text"
                placeholder="e.g. Senior Backend"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-xs rounded-xl p-3 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 font-medium text-slate-600 dark:text-slate-300 transition-all shadow-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer mt-2"
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Invite & Add Member
          </button>
          
          <p className="text-[9px] text-slate-500 dark:text-slate-500 font-medium text-center italic">
            Adding a teammate will send an invitation and include them in the project roster for ticket assignments.
          </p>
        </form>
      </div>
    </div>
  );
}
