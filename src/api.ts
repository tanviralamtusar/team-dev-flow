/**
 * api.ts
 * Typed REST API client for the SQLite/Express backend.
 * All functions mirror the Firebase operations previously in App.tsx.
 */
import { BoardItem, Column, Tag, Assignee, Profile, Project, Invitation } from "./types";

const BASE = "/api";

let authToken: string | null = localStorage.getItem("auth_token");
let currentProjectId: string | null = localStorage.getItem("current_project_id");

export const setToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem("auth_token", token);
  } else {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("current_project_id");
  }
};

export const setProjectId = (id: string | null) => {
  currentProjectId = id;
  if (id) {
    localStorage.setItem("current_project_id", id);
  } else {
    localStorage.removeItem("current_project_id");
  }
};

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = (options.headers as Record<string, string>) || {};
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  let finalUrl = `${BASE}${url}`;
  if (currentProjectId && (url.startsWith("/items") || url.startsWith("/columns") || url.startsWith("/tags") || url.startsWith("/assignees"))) {
    const separator = finalUrl.includes("?") ? "&" : "?";
    finalUrl += `${separator}projectId=${currentProjectId}`;
    
    if (options.method === "POST" || options.method === "PUT") {
      try {
        const body = JSON.parse(options.body as string);
        options.body = JSON.stringify({ ...body, projectId: currentProjectId });
      } catch {
        // Not JSON or no body
      }
    }
  } else if (!currentProjectId && (url.startsWith("/items") || url.startsWith("/columns") || url.startsWith("/tags") || url.startsWith("/assignees"))) {
    // If no project selected but trying to access project resources, we might want to handle it
    // For now, let it fail or handle in App.tsx
  }

  const res = await fetch(finalUrl, {
    ...options,
    headers,
  });

  if (res.status === 401 || res.status === 403) {
    setToken(null);
    window.location.reload();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (data: any) => 
  request<{ token: string; user: any }>("/auth/login", json("POST", data));

export const signup = (data: any) => 
  request<{ token: string; user: any }>("/auth/signup", json("POST", data));

export const getCurrentUser = () => 
  request<any>("/auth/me");

// ── Health ────────────────────────────────────────────────────────────────────
export async function checkHealth(): Promise<boolean> {
  try {
    await request<{ status: string }>("/health");
    return true;
  } catch {
    return false;
  }
}

// ── Items ─────────────────────────────────────────────────────────────────────
export const getItems = () => request<BoardItem[]>("/items");

export const saveItem = (item: BoardItem) =>
  request<BoardItem>("/items", json("POST", item));

export const updateItem = (id: string, item: BoardItem) =>
  request<BoardItem>(`/items/${id}`, json("PUT", item));

export const deleteItem = (id: string) =>
  request<{ success: boolean }>(`/items/${id}`, { method: "DELETE" });

// ── Columns ──────────────────────────────────────────────────────────────────
export const getColumns = () => request<Column[]>("/columns");

export const saveColumn = (col: Column) =>
  request<Column>("/columns", json("POST", col));

export const deleteColumn = (id: string) =>
  request<{ success: boolean }>(`/columns/${id}`, { method: "DELETE" });

// ── Tags ──────────────────────────────────────────────────────────────────────
export const getTags = () => request<Tag[]>("/tags");

export const saveTag = (tag: Tag) =>
  request<Tag>("/tags", json("POST", tag));

export const deleteTag = (id: string) =>
  request<{ success: boolean }>(`/tags/${id}`, { method: "DELETE" });

// ── Assignees ────────────────────────────────────────────────────────────────
export const getAssignees = () => request<Assignee[]>("/assignees");

export const saveAssignee = (assignee: Assignee) =>
  request<Assignee>("/assignees", json("POST", assignee));

export const deleteAssignee = (id: string) =>
  request<{ success: boolean }>(`/assignees/${id}`, { method: "DELETE" });

// ── Profiles ─────────────────────────────────────────────────────────────────
export const getProfile = (id: string) => request<Profile>(`/profiles/${id}`);

export const getAllProfiles = () => request<Profile[]>("/profiles");

export const createProfile = (profile: Omit<Profile, "createdAt">) =>
  request<Profile>("/profiles", json("POST", profile));

export const updateProfile = (id: string, data: Partial<Profile>) =>
  request<Profile>(`/profiles/${id}`, json("PUT", data));

// ── Projects ──────────────────────────────────────────────────────────────────
export const getProjects = () => request<Project[]>("/projects");

export const createProject = (name: string) => 
  request<Project>("/projects", json("POST", { name }));

export const sendHeartbeat = (projectId: string) =>
  request<{ activeCount: number }>(`/projects/${projectId}/heartbeat`, json("POST", {}));

// ── Invitations ───────────────────────────────────────────────────────────────
export const getInvitations = () => request<Invitation[]>("/invitations");

export const sendInvitation = (projectId: string, email: string) =>
  request<Invitation>("/invitations/invite", json("POST", { projectId, email }));

export const acceptInvitation = (id: string) =>
  request<{ success: boolean }>(`/invitations/${id}/accept`, json("POST", {}));

export const declineInvitation = (id: string) =>
  request<{ success: boolean }>(`/invitations/${id}/decline`, json("POST", {}));

/**
 * Upload a profile avatar image.
 * @param id       Profile ID
 * @param file     File object from an <input type="file">
 * @returns        { avatarUrl: string, profile: Profile }
 */
export async function uploadAvatar(
  id: string,
  file: File
): Promise<{ avatarUrl: string; profile: Profile }> {
  const formData = new FormData();
  formData.append("avatar", file);
  
  const headers: Record<string, string> = {};
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${BASE}/profiles/${id}/avatar`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
