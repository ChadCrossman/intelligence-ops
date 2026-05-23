import { useEffect, useMemo, useState } from "react";
import type { DashboardSnapshot } from "@pwio/shared";
import { getDashboard } from "./api.js";
import { QueryEditor } from "./QueryEditor.js";
import { ResultsReview } from "./ResultsReview.js";

const emptyDashboard: DashboardSnapshot = {
  queries: [],
  recentRuns: [],
  recentArticles: [],
  blogDrafts: [],
  emailCampaigns: []
};

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardSnapshot>(emptyDashboard);
  const [selectedQueryId, setSelectedQueryId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [activeView, setActiveView] = useState<"queries" | "review">("queries");
  const [isQueriesCollapsed, setIsQueriesCollapsed] = useState(false);

  async function refresh() {
    try {
      setError(undefined);
      const nextDashboard = await getDashboard();
      setDashboard(nextDashboard);
      setSelectedQueryId((current) => current ?? nextDashboard.queries[0]?.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const selectedQuery = useMemo(
    () => dashboard.queries.find((query) => query.id === selectedQueryId) ?? dashboard.queries[0],
    [dashboard.queries, selectedQueryId]
  );

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">Publish Weaver</p>
          <h1>Intelligence Ops</h1>
          <p>Define AI governance queries, schedule processing, rank the top results, and prepare blog and email draft workflows.</p>
        </div>
        <button onClick={() => void refresh()}>Refresh</button>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <nav className="view-tabs" aria-label="Primary views">
        <button className={activeView === "queries" ? "active" : ""} onClick={() => setActiveView("queries")}>
          Queries
        </button>
        <button className={activeView === "review" ? "active" : ""} onClick={() => setActiveView("review")}>
          Results review
        </button>
      </nav>

      {activeView === "queries" ? (
        <div className="layout">
          <aside className="panel sidebar">
            <div className="panel-heading">
              <h2>Queries</h2>
              <button
                className="collapse-toggle"
                aria-expanded={!isQueriesCollapsed}
                aria-controls="queries-list"
                onClick={() => setIsQueriesCollapsed((current) => !current)}
              >
                {isQueriesCollapsed ? "Expand" : "Collapse"}
              </button>
            </div>

            {!isQueriesCollapsed ? (
              <div className="collapsible-content" id="queries-list">
                {dashboard.queries.map((query) => (
                  <button
                    key={query.id}
                    className={query.id === selectedQuery?.id ? "query active" : "query"}
                    onClick={() => setSelectedQueryId(query.id)}
                  >
                    <strong>{query.name}</strong>
                    <span>
                      {query.frequency} - {query.status}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </aside>

          {selectedQuery ? <QueryEditor query={selectedQuery} onSaved={refresh} /> : null}
        </div>
      ) : (
        <ResultsReview dashboard={dashboard} onUpdated={refresh} />
      )}

      <section className="cards">
        <div className="panel">
          <h2>Recent runs</h2>
          {dashboard.recentRuns.length === 0 ? <p>No runs yet.</p> : null}
          {dashboard.recentRuns.map((run) => (
            <div className="row" key={run.id}>
              <span>{run.status}</span>
              <strong>
                {run.articlesSelected}/{run.articlesFound} selected
              </strong>
              <small>{new Date(run.startedAt).toLocaleString()}</small>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2>Top articles</h2>
          {dashboard.recentArticles.slice(0, 8).map((article) => (
            <div className="article" key={article.id}>
              <strong>{article.title}</strong>
              <span>
                {article.source} - score {article.relevanceScore}
              </span>
              <p>{article.snippet}</p>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2>Draft outputs</h2>
          <p>{dashboard.blogDrafts.length} blog drafts</p>
          <p>{dashboard.emailCampaigns.length} email synopsis drafts</p>
          {dashboard.blogDrafts.slice(0, 5).map((draft) => (
            <div className="row" key={draft.id}>
              <strong>{draft.title}</strong>
              <span>{draft.status}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
