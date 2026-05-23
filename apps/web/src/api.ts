import type { DashboardSnapshot, QueryDefinition, QueryRun, RetrievedArticle } from "@pwio/shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3150";

async function checkResponse(response: Response, context: string): Promise<void> {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    const detail = body?.message ?? `HTTP ${response.status}`;
    throw new Error(`${context}: ${detail}`);
  }
}

export async function getDashboard(): Promise<DashboardSnapshot> {
  const response = await fetch(`${API_BASE}/api/dashboard`);
  await checkResponse(response, "Failed to load dashboard");
  return response.json() as Promise<DashboardSnapshot>;
}

export async function saveQuery(query: Partial<QueryDefinition>): Promise<QueryDefinition> {
  const response = await fetch(`${API_BASE}/api/queries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query)
  });

  await checkResponse(response, "Failed to save query");
  return response.json() as Promise<QueryDefinition>;
}

export async function runQuery(id: string): Promise<QueryRun> {
  const response = await fetch(`${API_BASE}/api/queries/${id}/run`, {
    method: "POST"
  });

  await checkResponse(response, "Failed to run query");
  return response.json() as Promise<QueryRun>;
}

export async function updateArticleStatus(id: string, status: RetrievedArticle["status"]): Promise<RetrievedArticle> {
  const response = await fetch(`${API_BASE}/api/articles/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });

  await checkResponse(response, "Failed to update article status");
  return response.json() as Promise<RetrievedArticle>;
}
