/**
 * api.ts
 * Typed REST API client for the SQLite/Express backend.
 * All functions mirror the Firebase operations previously in App.tsx.
 */
import { BoardItem, Column, Tag, Assignee, Profile } from "./types";

const BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, options);
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
  const res = await fetch(`${BASE}/profiles/${id}/avatar`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
