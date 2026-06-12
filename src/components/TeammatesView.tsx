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
  
  // Teammate Form States
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [memberColor, setMemberColor] = useState(AVATAR_COLORS[0]);
  const [isInviteLoading, setIsInviteLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isSendingInvitation, setIsSendingInvitation] = useState(false);

  // Handler: Add Teammate
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    setIsInviteLoading(true);
    try {
      const profiles = await api.getAllProfiles();
      const existingProfile = profiles.find(p => p.email.toLowerCase() === newMemberEmail.trim().toLowerCase());

      const newMember: Assignee = {
        id: existingProfile ? existingProfile.id : `dev-${Date.now()}`,
        name: newMemberName.trim(),
        avatarColor: memberColor,
        role: newMemberRole.trim() || (existingProfile?.role) || "Developer",
        email: newMemberEmail.trim() || "dev@company.com",
      };

      onUpdateAssignees([...assignees, newMember]);
      setNewMemberName("");
      setNewMemberRole("");
      setNewMemberEmail("");
      
      const nextIdx = (AVATAR_COLORS.indexOf(memberColor) + 1) % AVATAR_COLORS.length;
      setMemberColor(AVATAR_COLORS[nextIdx]);
    } catch (err) {
      console.error("Failed to add member:", err);
      alert("Error linking team member. Check console for details.");
    } finally {
      setIsInviteLoading(false);
    }
  };

  // Handler: Delete Teammate
  const handleDeleteMember = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove ${name} from the team? Board items assigned to them will continue to exist but show as unassigned.`)) {
      onUpdateAssignees(assignees.filter((a) => a.id !== id));
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !projectId) return;

    setIsSendingInvitation(true);
    try {
      await api.sendInvitation(projectId, inviteEmail.trim());
      alert(`Invitation sent to ${inviteEmail.trim()}!`);
      setInviteEmail("");
    } catch (err: any) {
      alert(err.message || "Failed to send invitation");
    } finally {
      setIsSendingInvitation(false);
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          {/* Invitation Form Panel */}
          <form onSubmit={handleInviteUser} className="bg-amber-50/30 dark:bg-amber-900/10 p-5 rounded-xl border border-amber-100 dark:border-amber-900/30 space-y-4">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 font-mono tracking-wider uppercase block flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              Invite Collaborator
            </span>
            <div className="space-y-2">
              <input
                type="email"
                required
                placeholder="teammate@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-xs rounded-xl p-2.5 outline-none focus:border-amber-400 dark:focus:border-amber-500 font-medium text-slate-600 dark:text-slate-300"
              />
              <button
                type="submit"
                disabled={isSendingInvitation}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                {isSendingInvitation ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Send Invitation
              </button>
            </div>
            <p className="text-[9px] text-amber-600/70 dark:text-amber-500/50 font-medium">Invited users will see a notification on their dashboard to join this project.</p>
          </form>

          {/* Add Teammate Form Panel */}
          <form onSubmit={handleAddMember} className="bg-slate-50/50 dark:bg-slate-900/40 p-5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono tracking-wider uppercase block">PROVISION TEAMMATE</span>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label htmlFor="member-name-input" className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold uppercase">FULL NAME</label>
                  <input
                    id="member-name-input"
                    type="text"
                    required
                    placeholder="Rachel Green"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-xs rounded-xl p-2 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 font-medium text-slate-600 dark:text-slate-300"
                  />
                </div>
                
                <div className="space-y-1">
                  <label htmlFor="member-role-input" className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold uppercase">ROLE</label>
                  <input
                    id="member-role-input"
                    type="text"
                    placeholder="Senior Dev"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-xs rounded-xl p-2 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 font-medium text-slate-600 dark:text-slate-300"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="member-email-input" className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold uppercase">EMAIL</label>
                <input
                  id="member-email-input"
                  type="email"
                  placeholder="rachel@company.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="w-full bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 text-xs rounded-xl p-2 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 font-medium text-slate-600 dark:text-slate-300"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-semibold uppercase block">AVATAR COLOR</span>
                <div className="flex gap-1.5 py-1">
                  {AVATAR_COLORS.map((col) => (
                    <button
                      type="button"
                      key={col}
                      onClick={() => setMemberColor(col)}
                      className={`w-6 h-6 rounded-lg ${col} border-0 transition-all ${
                        memberColor === col ? "ring-2 ring-indigo-500 scale-110 shadow-sm" : "scale-95 opacity-70"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isInviteLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border-0 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                {isInviteLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Member
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
