import type {
    CallRecord,
    CallConsoleSettings,
    CreateCallPayload,
    CreateCallResponse,
  DashboardSummary,
  DashboardTimeseries,
  DocumentRecord,
  IntegrationStatus,
  PromptPreview,
} from "@/lib/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000/api";

export type FilterParams = {
  days: number;
  status: string;
  voice: string;
  direction: string;
  sentiment: string;
  topic: string;
  tag: string;
};

function createSearchParams(filters: Partial<FilterParams> & { refresh?: boolean; source?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (filters.days) params.set("days", String(filters.days));
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.voice && filters.voice !== "all") params.set("voice", filters.voice);
  if (filters.direction && filters.direction !== "all") params.set("direction", filters.direction);
  if (filters.sentiment && filters.sentiment !== "all") params.set("sentiment", filters.sentiment);
  if (filters.topic && filters.topic !== "all") params.set("topic", filters.topic);
  if (filters.tag && filters.tag !== "all") params.set("tag", filters.tag);
  if (filters.source) params.set("source", filters.source);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.refresh) params.set("refresh", "true");
  return params.toString();
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed.");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

export async function getDashboardSummary(filters: FilterParams, refresh = false) {
  return fetchJson<DashboardSummary>(`/dashboard/summary?${createSearchParams({ ...filters, refresh })}`);
}

export async function getDashboardTimeseries(filters: FilterParams, refresh = false) {
  return fetchJson<DashboardTimeseries>(`/dashboard/timeseries?${createSearchParams({ ...filters, refresh })}`);
}

export async function getCalls(source?: string, limit = 50) {
  return fetchJson<CallRecord[]>(`/calls?${createSearchParams({ source, limit, days: 90 })}`);
}

export async function previewPrompt(payload: CreateCallPayload) {
  return fetchJson<PromptPreview>("/prompts/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createCall(payload: CreateCallPayload) {
  return fetchJson<CreateCallResponse>("/calls", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function refreshCallStatus(callId: string) {
  return fetchJson<CallRecord>(`/calls/${callId}/refresh-status`, {
    method: "POST",
  });
}

export async function getDocuments() {
  return fetchJson<DocumentRecord[]>("/knowledge/documents");
}

export async function deleteDocument(documentId: string) {
  return fetchJson<void>(`/knowledge/documents/${documentId}`, {
    method: "DELETE",
    headers: {},
  });
}

export async function uploadDocument(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<DocumentRecord> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/knowledge/documents`);
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as DocumentRecord);
      } else {
        reject(new Error((xhr.response as { detail?: string })?.detail ?? "Upload failed."));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed."));
    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export async function getIntegrationStatus() {
  return fetchJson<IntegrationStatus>("/integrations/status");
}

export async function getCallConsoleSettings() {
  return fetchJson<CallConsoleSettings>("/settings/call-console");
}

export async function updateCallConsoleSettings(payload: CallConsoleSettings) {
  return fetchJson<CallConsoleSettings>("/settings/call-console", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
