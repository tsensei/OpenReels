const API_BASE = "/api/v1";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((error as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export interface JobSummary {
  id: string;
  topic: string;
  archetype?: string;
  status: string;
  createdAt?: string;
  completedAt?: string;
  videoPath?: string;
  stages?: Record<string, { status: string; detail?: string; durationSec?: number }>;
  costEstimate?: { totalCost: number };
  actualCost?: { totalCost: number };
}

export interface Archetype {
  name: string;
  captionStyle: string;
  artStyle: string;
  mood: string;
}

export interface Platform {
  name: string;
  width: number;
  height: number;
  fps: number;
  maxDurationSeconds: number;
}

export interface ProviderOption {
  key: string;
  label: string;
}

export interface ProviderOptions {
  llm: ProviderOption[];
  tts: ProviderOption[];
  image: ProviderOption[];
}

export interface CreateJobRequest {
  topic: string;
  archetype?: string;
  platform?: string;
  dryRun?: boolean;
  providers?: {
    llm?: string;
    tts?: string;
    image?: string;
  };
}

export const api = {
  createJob(data: CreateJobRequest) {
    return fetchJson<{ id: string }>("/jobs", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  listJobs(limit = 20, offset = 0) {
    return fetchJson<{ jobs: JobSummary[]; total: number }>(
      `/jobs?limit=${limit}&offset=${offset}`,
    );
  },

  getJob(id: string) {
    return fetchJson<JobSummary>(`/jobs/${id}`);
  },

  cancelJob(id: string) {
    return fetchJson<{ status: string }>(`/jobs/${id}/cancel`, { method: "POST" });
  },

  deleteJob(id: string) {
    return fetchJson<{ status: string }>(`/jobs/${id}`, { method: "DELETE" });
  },

  listArchetypes() {
    return fetchJson<Archetype[]>("/archetypes");
  },

  listPlatforms() {
    return fetchJson<Platform[]>("/platforms");
  },

  listProviders() {
    return fetchJson<ProviderOptions>("/providers");
  },

  getHealth() {
    return fetchJson<{ status: string; redis: string }>("/health");
  },
};
