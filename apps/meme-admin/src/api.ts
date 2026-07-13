import type { AdminSettings, BatchConfig, FolderTemplateStatus, GroupConfig, JobRecord, ResultFile } from "../shared/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(body.message ?? "请求失败");
  }
  return response.json() as Promise<T>;
}

export const api = {
  batches: () => request<BatchConfig[]>("/api/batches"),
  createBatch: (body: { name: string; sourceFolder: string }) => request<BatchConfig>("/api/batches", { method: "POST", body: JSON.stringify(body) }),
  importBatch: (path: string) => request<BatchConfig>("/api/batches/import", { method: "POST", body: JSON.stringify({ path }) }),
  saveBatch: (batch: BatchConfig) => request<BatchConfig>(`/api/batches/${batch.id}`, { method: "PUT", body: JSON.stringify(batch) }),
  rescan: (id: string) => request<BatchConfig>(`/api/batches/${id}/rescan`, { method: "POST" }),
  folderTemplates: (id: string) => request<FolderTemplateStatus[]>(`/api/batches/${id}/folder-templates`),
  addGroup: (id: string, name: string) => request<BatchConfig>(`/api/batches/${id}/groups`, { method: "POST", body: JSON.stringify({ name }) }),
  saveGroup: (batchId: string, group: GroupConfig) => request<BatchConfig>(`/api/batches/${batchId}/groups/${group.id}`, { method: "PUT", body: JSON.stringify(group) }),
  deleteGroup: (batchId: string, groupId: string) => request<BatchConfig>(`/api/batches/${batchId}/groups/${groupId}`, { method: "DELETE" }),
  assign: (batchId: string, groupId: string | undefined, imageIds: string[]) => request<BatchConfig>(`/api/batches/${batchId}/assign`, { method: "POST", body: JSON.stringify({ groupId, imageIds }) }),
  organize: (batchId: string, groupId: string) => request<{ files: string[] }>(`/api/batches/${batchId}/groups/${groupId}/organize`, { method: "POST" }),
  jobs: () => request<JobRecord[]>("/api/jobs"),
  createJob: (batchId: string, groupId: string) => request<JobRecord>("/api/jobs", { method: "POST", body: JSON.stringify({ batchId, groupId }) }),
  cancelJob: (id: string) => request<JobRecord>(`/api/jobs/${id}/cancel`, { method: "POST" }),
  retryJob: (id: string) => request<JobRecord>(`/api/jobs/${id}/retry`, { method: "POST" }),
  files: (id: string) => request<ResultFile[]>(`/api/jobs/${id}/files`),
  settings: () => request<AdminSettings>("/api/settings"),
  saveSettings: (settings: AdminSettings) => request<AdminSettings>("/api/settings", { method: "PUT", body: JSON.stringify(settings) }),
  pickDirectory: () => request<{ path: string }>("/api/system/pick-directory", { method: "POST" }),
  openFolder: (path: string) => request<{ ok: boolean }>("/api/system/open-folder", { method: "POST", body: JSON.stringify({ path }) }),
};
