import { BoardItem, Column, Tag, Assignee, ItemType, Priority } from "./types";

export const INITIAL_COLUMNS: Column[] = [
  { id: "backlog", title: "Backlog", color: "bg-slate-100 border-slate-200", textClass: "text-slate-600 bg-slate-100" },
  { id: "todo", title: "To Do", color: "bg-blue-50/50 border-blue-100", textClass: "text-blue-700 bg-blue-100/80" },
  { id: "in_progress", title: "In Progress", color: "bg-amber-50/40 border-amber-100", textClass: "text-amber-700 bg-amber-100/70" },
  { id: "in_review", title: "In Review", color: "bg-purple-50/40 border-purple-100", textClass: "text-purple-700 bg-purple-100/80" },
  { id: "done", title: "Done", color: "bg-emerald-50/30 border-emerald-100", textClass: "text-emerald-700 bg-emerald-100/80" },
];

export const INITIAL_TAGS: Tag[] = [
  { id: "front", name: "Frontend", color: "sky", bgClass: "bg-sky-400/10 text-sky-400 border-sky-400/20", textClass: "text-sky-400" },
  { id: "back", name: "Backend", color: "indigo", bgClass: "bg-indigo-400/10 text-indigo-400 border-indigo-400/20", textClass: "text-indigo-400" },
  { id: "api", name: "API Rate", color: "emerald", bgClass: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20", textClass: "text-emerald-400" },
  { id: "sec", name: "Security", color: "rose", bgClass: "bg-rose-400/10 text-rose-400 border-rose-400/20", textClass: "text-rose-400" },
  { id: "perf", name: "Performance", color: "amber", bgClass: "bg-amber-400/10 text-amber-400 border-amber-400/20", textClass: "text-amber-400" },
  { id: "qa", name: "QA Verified", color: "fuchsia", bgClass: "bg-fuchsia-400/10 text-fuchsia-400 border-fuchsia-400/20", textClass: "text-fuchsia-400" },
];

export const INITIAL_ASSIGNEES: Assignee[] = [
  { id: "alam", name: "Alam Tanvir", avatarColor: "bg-blue-600 text-white", role: "Lead Dev", email: "alamtanvir2006@gmail.com" },
];

export const INITIAL_ITEMS: BoardItem[] = [
  {
    id: "item-1",
    title: "Stripe Checkout Crash on 3D Secure Verification",
    description: "Production logs report frequent 500 errors when users trigger 3D Secure authentications in Stripe Elements checkout workflows. Appears to be an unchecked signature validation error inside the API route handler.",
    type: ItemType.ERROR,
    priority: Priority.URGENT,
    status: "todo",
    assigneeId: "alam",
    storyPoints: 8,
    dueDate: "2026-06-12",
    tags: ["back", "sec"],
    subtasks: [
      { id: "sub-1-1", title: "Trace crash log payload in Cloud Logging", completed: true },
      { id: "sub-1-2", title: "Replicate webhook authentication local test case", completed: false },
      { id: "sub-1-3", title: "Update validation middlewares to catch empty signatures", completed: false },
    ],
    history: [
      { id: "hist-1-1", timestamp: "2026-06-10T08:30:00Z", user: "Server System", action: "Error automatically caught and ingested into board" },
      { id: "hist-1-2", timestamp: "2026-06-10T09:00:00Z", user: "Alam Tanvir", action: "Assigned item to Alam Tanvir and raised priority to URGENT" }
    ],
    createdDate: "2026-06-10T08:30:00Z"
  },
  {
    id: "item-2",
    title: "Create CSV and Excel Export for Accounting Audits",
    description: "Build an extensible reports dashboard download utility. Need to generate clean sheets directly on client side to keep server processing minimal and robust.",
    type: ItemType.FEATURE,
    priority: Priority.MEDIUM,
    status: "in_progress",
    assigneeId: "alam",
    storyPoints: 5,
    dueDate: "2026-06-18",
    tags: ["front", "api"],
    subtasks: [
      { id: "sub-2-1", title: "Design clean custom table visual schema mapping", completed: true },
      { id: "sub-2-2", title: "Implement CSV raw string builder with escaping utilities", completed: true },
      { id: "sub-2-3", title: "Wire Excel sheet styling schema options", completed: false }
    ],
    history: [
      { id: "hist-2-1", timestamp: "2026-06-09T10:00:00Z", user: "Alam Tanvir", action: "Created feature ticket from Product Backlog guidelines" },
      { id: "hist-2-2", timestamp: "2026-06-10T09:15:00Z", user: "Alam Tanvir", action: "Moved item from 'To Do' to 'In Progress'" }
    ],
    createdDate: "2026-06-09T10:00:00Z"
  },
  {
    id: "item-3",
    title: "Mobile Header Overflow on Navigation Menu Toggle",
    description: "On iOS Safari and Android Chrome, toggling the dashboard menu causes the header to shift 24px right resulting in weird layout shifts. Needs viewport CSS adjustment on overlay element.",
    type: ItemType.BUG,
    priority: Priority.HIGH,
    status: "in_review",
    assigneeId: "alam",
    storyPoints: 2,
    dueDate: "2026-06-11",
    tags: ["front"],
    subtasks: [
      { id: "sub-3-1", title: "Isolate overflow-x scroll indicators in tailwind", completed: true },
      { id: "sub-3-2", title: "Test container shifts across representative screen sizes", completed: true },
    ],
    history: [
      { id: "hist-3-1", timestamp: "2026-06-08T14:20:00Z", user: "Alam Tanvir", action: "Opened bug ticket from QA feedback cycles" },
      { id: "hist-3-2", timestamp: "2026-06-10T09:10:00Z", user: "Alam Tanvir", action: "Moved item to 'In Review' for deployment clearance" }
    ],
    createdDate: "2026-06-08T14:20:00Z"
  },
  {
    id: "item-4",
    title: "Implement ESLint Rules & TS Strict Configs",
    description: "Standardize formatting norms across modules to eliminate untyped parameters and reduce runtime bugs in dev loops.",
    type: ItemType.TASK,
    priority: Priority.LOW,
    status: "done",
    assigneeId: "alam",
    storyPoints: 3,
    dueDate: "2026-06-05",
    tags: ["qa"],
    subtasks: [
      { id: "sub-4-1", title: "Add strict null check validation inside tsconfig", completed: true },
      { id: "sub-4-2", title: "Run clean validation testing pipeline checking for regressions", completed: true }
    ],
    history: [
      { id: "hist-4-1", timestamp: "2026-06-01T11:00:00Z", user: "Alam Tanvir", action: "Created code standard ticket" },
      { id: "hist-4-2", timestamp: "2026-06-05T16:00:00Z", user: "Alam Tanvir", action: "Succeeded in merging standard rules & closed task" }
    ],
    createdDate: "2026-06-01T11:00:00Z"
  },
  {
    id: "item-5",
    title: "Database Isolation Lock Failures on Concurrent API Submissions",
    description: "Two quick payment triggers result in deadlocks inside transactional blocks in Postgres DB. Optimize execution using query lock hints.",
    type: ItemType.BUG,
    priority: Priority.URGENT,
    status: "backlog",
    assigneeId: "alam",
    storyPoints: 5,
    dueDate: "2026-06-15",
    tags: ["back", "perf"],
    subtasks: [
      { id: "sub-5-1", title: "Refactor locks using select-for-update structures", completed: false },
      { id: "sub-5-2", title: "Simulate concurrent lock assertions in unit files", completed: false }
    ],
    history: [
      { id: "hist-5-1", timestamp: "2026-06-10T02:00:00Z", user: "Server System", action: "Ingest failure logs on database connection pool instances" }
    ],
    createdDate: "2026-06-10T02:00:00Z"
  },
  {
    id: "item-6",
    title: "Support Auto-Save for Draft Settings Panels",
    description: "Improve UX on config panels. Enable draft state preservation so that inputs aren't deleted in case page gets reloaded in web clients.",
    type: ItemType.FEATURE,
    priority: Priority.LOW,
    status: "backlog",
    dueDate: "2026-06-25",
    tags: ["front"],
    subtasks: [
      { id: "sub-6-1", title: "Introduce window beforeunload listener states", completed: false }
    ],
    history: [],
    createdDate: "2026-06-09T15:00:00Z"
  }
];
