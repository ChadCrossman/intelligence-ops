import { useMemo, useState } from "react";
import type { DashboardSnapshot, RetrievedArticle } from "@pwio/shared";
import { updateArticleStatus } from "./api.js";

interface ResultsReviewProps {
  dashboard: DashboardSnapshot;
  onUpdated: () => Promise<void>;
}

const reviewStatuses: RetrievedArticle["status"][] = ["new", "accepted", "selected", "rejected"];

function statusLabel(status: RetrievedArticle["status"]): string {
  switch (status) {
    case "new":
      return "New";
    case "accepted":
      return "Accepted";
    case "selected":
      return "Selected";
    case "rejected":
      return "Rejected";
  }
}

export function ResultsReview({ dashboard, onUpdated }: ResultsReviewProps): React.JSX.Element {
  const [statusFilter, setStatusFilter] = useState<RetrievedArticle["status"] | "all">("all");
  const [updatingArticleId, setUpdatingArticleId] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();

  const articles = useMemo(() => {
    return dashboard.recentArticles.filter((article) => statusFilter === "all" || article.status === statusFilter);
  }, [dashboard.recentArticles, statusFilter]);

  const counts = useMemo(() => {
    return dashboard.recentArticles.reduce(
      (nextCounts, article) => {
        nextCounts[article.status] += 1;
        return nextCounts;
      },
      { new: 0, accepted: 0, rejected: 0, selected: 0 } satisfies Record<RetrievedArticle["status"], number>
    );
  }, [dashboard.recentArticles]);

  async function handleStatusChange(article: RetrievedArticle, status: RetrievedArticle["status"]) {
    if (article.status === status) return;

    setUpdatingArticleId(article.id);
    setError(undefined);

    try {
      await updateArticleStatus(article.id, status);
      await onUpdated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setUpdatingArticleId(undefined);
    }
  }

  return (
    <section className="panel results-review">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Review queue</p>
          <h2>Retrieved articles</h2>
        </div>
        <div className="status-filter" aria-label="Filter articles by status">
          <button className={statusFilter === "all" ? "active" : ""} onClick={() => { setStatusFilter("all"); }}>
            All
            <span>{dashboard.recentArticles.length}</span>
          </button>
          {reviewStatuses.map((status) => (
            <button key={status} className={statusFilter === status ? "active" : ""} onClick={() => { setStatusFilter(status); }}>
              {statusLabel(status)}
              <span>{counts[status]}</span>
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {articles.length === 0 ? <p className="muted">No articles match this status.</p> : null}

      <div className="review-list">
        {articles.map((article) => (
          <article className={`review-item ${article.status}`} key={article.id}>
            <div className="review-main">
              <div className="article-meta">
                <span>{article.source}</span>
                <span>Score {article.relevanceScore}</span>
                <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
              </div>
              <h3>
                <a href={article.url} target="_blank" rel="noreferrer">
                  {article.title}
                </a>
              </h3>
              <p>{article.snippet}</p>
            </div>

            <div className="review-actions" aria-label={`Set status for ${article.title}`}>
              {reviewStatuses
                .filter((status) => status !== "new")
                .map((status) => (
                  <button
                    key={status}
                    className={article.status === status ? "active" : ""}
                    disabled={updatingArticleId === article.id}
                    onClick={() => { void handleStatusChange(article, status); }}
                  >
                    {statusLabel(status)}
                  </button>
                ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
