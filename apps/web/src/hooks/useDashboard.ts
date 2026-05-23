import { useEffect, useState } from "react";
import type { DashboardSnapshot } from "@pwio/shared";
import { getDashboard } from "../api.js";

const emptyDashboard: DashboardSnapshot = {
  queries: [],
  recentRuns: [],
  recentArticles: [],
  blogDrafts: [],
  emailCampaigns: []
};

interface UseDashboardResult {
  dashboard: DashboardSnapshot;
  error: string | undefined;
  refresh: () => Promise<void>;
}

export function useDashboard(): UseDashboardResult {
  const [dashboard, setDashboard] = useState<DashboardSnapshot>(emptyDashboard);
  const [error, setError] = useState<string | undefined>();

  async function refresh() {
    try {
      setError(undefined);
      const next = await getDashboard();
      setDashboard(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return { dashboard, error, refresh };
}
