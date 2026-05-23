import type { DashboardSnapshot, QueryDefinition, QueryRun } from "@pwio/shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

export async function getDashboard(): Promise<DashboardSnapshot> {
  const response = await fetch(`${API_BASE}/api/dashboard`);
  if (!response.ok) throw new Error("Failed to load dashboard");
  return response.json();
}

export async function saveQuery(query: Partial<QueryDefinition>): Promise<QueryDefinition> {
  const response = await fetch(`${API_BASE}/api/queries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(query)
  });

  if (!response.ok) throw new Error("Failed to save query");
  return response.json();
}

export async function runQuery(id: string): Promise<QueryRun> {
  const response = await fetch(`${API_BASE}/api/queries/${id}/run`, {
    method: "POST"
  });

  if (!response.ok) throw new Error("Failed to run query");
  return response.json();
}
