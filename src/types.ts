export enum ItemType {
  TASK = "task",
  BUG = "bug",
  ERROR = "error",
  FEATURE = "feature",
}

export enum Priority {
  URGENT = "urgent",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
}

export interface BoardItem {
  id: string;
  title: string;
  description: string;
  type: ItemType;
  priority: Priority;
  status: string; // column.id
  assigneeId?: string;
  storyPoints?: number; // estimates
  dueDate?: string;
  tags: string[]; // tag ids
  subtasks: SubTask[];
  history: ActivityLog[];
  createdDate: string;
  images?: string[];
}

export interface Column {
  id: string;
  title: string;
  color: string; // Tailwind bg color class
  textClass: string; // Tailwind text color class
}

export interface Tag {
  id: string;
  name: string;
  color: string; // prefix class or name representation
  bgClass: string;
  textClass: string;
}

export interface Assignee {
  id: string;
  name: string;
  avatarColor: string; // Tailwind bg-color class
  role: string;
  email: string;
}

export interface Profile {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  githubId?: string;
  role?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  activeCount?: number;
}

export interface Invitation {
  id: string;
  projectId: string;
  projectName: string;
  inviterId: string;
  inviterName: string;
  email: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}
