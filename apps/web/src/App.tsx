import { useEffect, useMemo, useState } from "react";
import type { DashboardSnapshot, QueryDefinition, ScheduleFrequency } from "@pwio/shared";
import { getDashboard, runQuery, saveQuery } from "./api.js";

const emptyDashboard: DashboardSnapshot = {
  queries: [],
  recentRuns: [],
  recentArticles: [],
  blogDrafts: [],
  emailCampaigns: []
};

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function QueryEditor({
  query,
  onSaved
}: {
  query: QueryDefinition;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(query);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => setDraft(query), [query]);

  async function handleSave() {
    setIsSaving(true);
    try {
      await saveQuery(draft);
      await onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRun() {
    setIsRunning(true);
    try {
      await runQuery(draft.id);
      await onSaved();
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <section className="panel editor">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Query pipeline</p>
          <h2>{draft.name}</h2>
        </div>
        <div className="actions">
          <button onClick={handleRun} disabled={isRunning}>
            {isRunning ? "Running..." : "Run now"}
          </button>
          <button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <label>
        Name
        <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      </label>

      <label>
        Description
        <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      </label>

      <label>
        Base query
        <textarea className="query-box" value={draft.baseQuery} onChange={(event) => setDraft({ ...draft, baseQuery: event.target.value })} />
      </label>

      <div className="grid-2">
        <label>
          Include terms, comma-separated
          <input value={draft.includeTerms.join(", ")} onChange={(event) => setDraft({ ...draft, includeTerms: splitCsv(event.target.value) })} />
        </label>

        <label>
          Exclude terms, comma-separated
          <input value={draft.excludeTerms.join(", ")} onChange={(event) => setDraft({ ...draft, excludeTerms: splitCsv(event.target.value) })} />
        </label>
      </div>

      <div className="grid-2">
        <label>
          Target domains, comma-separated
          <input value={draft.targetDomains.join(", ")} onChange={(event) => setDraft({ ...draft, targetDomains: splitCsv(event.target.value) })} />
        </label>

        <label>
          Governance themes, comma-separated
          <input value={draft.governanceThemes.join(", ")} onChange={(event) => setDraft({ ...draft, governanceThemes: splitCsv(event.target.value) })} />
        </label>
      </div>

      <div className="grid-4">
        <label>
          Date window
          <input type="number" min="1" value={draft.dateWindowDays} onChange={(event) => setDraft({ ...draft, dateWindowDays: Number(event.target.value) })} />
        </label>

        <label>
          Top X
          <input type="number" min="1" value={draft.topX} onChange={(event) => setDraft({ ...draft, topX: Number(event.target.value) })} />
        </label>

        <label>
          Min score
          <input type="number" min="0" max="100" value={draft.minimumScore} onChange={(event) => setDraft({ ...draft, minimumScore: Number(event.target.value) })} />
        </label>

        <label>
          Schedule
          <select value={draft.frequency} onChange={(event) => setDraft({ ...draft, frequency: event.target.value as ScheduleFrequency })}>
            <option value="manual">Manual</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
      </div>

      <label className="inline">
        <input
          type="checkbox"
          checked={draft.status === "enabled"}
          onChange={(event) => setDraft({ ...draft, status: event.target.checked ? "enabled" : "paused" })}
        />
        Enabled
      </label>
    </section>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardSnapshot>(emptyDashboard);
  const [selectedQueryId, setSelectedQueryId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

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

      <div className="layout">
        <aside className="panel sidebar">
          <div className="panel-heading">
            <h2>Queries</h2>
          </div>

          {dashboard.queries.map((query) => (
            <button
              key={query.id}
              className={query.id === selectedQuery?.id ? "query active" : "query"}
              onClick={() => setSelectedQueryId(query.id)}
            >
              <strong>{query.name}</strong>
              <span>{query.frequency} · {query.status}</span>
            </button>
          ))}
        </aside>

        {selectedQuery ? <QueryEditor query={selectedQuery} onSaved={refresh} /> : null}
      </div>

      <section className="cards">
        <div className="panel">
          <h2>Recent runs</h2>
          {dashboard.recentRuns.length === 0 ? <p>No runs yet.</p> : null}
          {dashboard.recentRuns.map((run) => (
            <div className="row" key={run.id}>
              <span>{run.status}</span>
              <strong>{run.articlesSelected}/{run.articlesFound} selected</strong>
              <small>{new Date(run.startedAt).toLocaleString()}</small>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2>Top articles</h2>
          {dashboard.recentArticles.slice(0, 8).map((article) => (
            <div className="article" key={article.id}>
              <strong>{article.title}</strong>
              <span>{article.source} · score {article.relevanceScore}</span>
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
