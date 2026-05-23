import { useEffect, useMemo, useState } from "react";
import type { QueryDefinition, ScheduleFrequency } from "@pwio/shared";
import { runQuery, saveQuery } from "./api.js";

type ValidationErrors = Partial<Record<"name" | "baseQuery" | "dateWindowDays" | "topX" | "minimumScore", string>>;

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateQuery(query: QueryDefinition): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!query.name.trim()) {
    errors.name = "Name is required.";
  }

  if (!query.baseQuery.trim()) {
    errors.baseQuery = "Base query is required.";
  }

  if (!Number.isInteger(query.dateWindowDays) || query.dateWindowDays < 1 || query.dateWindowDays > 365) {
    errors.dateWindowDays = "Use a whole number from 1 to 365.";
  }

  if (!Number.isInteger(query.topX) || query.topX < 1 || query.topX > 50) {
    errors.topX = "Use a whole number from 1 to 50.";
  }

  if (!Number.isInteger(query.minimumScore) || query.minimumScore < 0 || query.minimumScore > 100) {
    errors.minimumScore = "Use a whole number from 0 to 100.";
  }

  return errors;
}

function toNumber(value: string): number {
  return value === "" ? Number.NaN : Number(value);
}

export function QueryEditor({
  query,
  onSaved
}: {
  query: QueryDefinition;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(query);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    setDraft(query);
    setHasSubmitted(false);
  }, [query]);

  const validationErrors = useMemo(() => validateQuery(draft), [draft]);
  const isValid = Object.keys(validationErrors).length === 0;
  const showErrors = hasSubmitted && !isValid;

  async function handleSave() {
    setHasSubmitted(true);
    if (!isValid) return;

    setIsSaving(true);
    try {
      await saveQuery(draft);
      await onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRun() {
    setHasSubmitted(true);
    if (!isValid) return;

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
          <button onClick={handleRun} disabled={isRunning || isSaving}>
            {isRunning ? "Running..." : "Run now"}
          </button>
          <button onClick={handleSave} disabled={isSaving || isRunning}>
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {showErrors ? <div className="validation-summary">Fix the highlighted fields before continuing.</div> : null}

      <label>
        Name
        <input
          value={draft.name}
          aria-invalid={Boolean(validationErrors.name)}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        {hasSubmitted && validationErrors.name ? <span className="field-error">{validationErrors.name}</span> : null}
      </label>

      <label>
        Description
        <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      </label>

      <label>
        Base query
        <textarea
          className="query-box"
          value={draft.baseQuery}
          aria-invalid={Boolean(validationErrors.baseQuery)}
          onChange={(event) => setDraft({ ...draft, baseQuery: event.target.value })}
        />
        {hasSubmitted && validationErrors.baseQuery ? <span className="field-error">{validationErrors.baseQuery}</span> : null}
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
          <input
            type="number"
            min="1"
            max="365"
            value={Number.isNaN(draft.dateWindowDays) ? "" : draft.dateWindowDays}
            aria-invalid={Boolean(validationErrors.dateWindowDays)}
            onChange={(event) => setDraft({ ...draft, dateWindowDays: toNumber(event.target.value) })}
          />
          {hasSubmitted && validationErrors.dateWindowDays ? <span className="field-error">{validationErrors.dateWindowDays}</span> : null}
        </label>

        <label>
          Top X
          <input
            type="number"
            min="1"
            max="50"
            value={Number.isNaN(draft.topX) ? "" : draft.topX}
            aria-invalid={Boolean(validationErrors.topX)}
            onChange={(event) => setDraft({ ...draft, topX: toNumber(event.target.value) })}
          />
          {hasSubmitted && validationErrors.topX ? <span className="field-error">{validationErrors.topX}</span> : null}
        </label>

        <label>
          Min score
          <input
            type="number"
            min="0"
            max="100"
            value={Number.isNaN(draft.minimumScore) ? "" : draft.minimumScore}
            aria-invalid={Boolean(validationErrors.minimumScore)}
            onChange={(event) => setDraft({ ...draft, minimumScore: toNumber(event.target.value) })}
          />
          {hasSubmitted && validationErrors.minimumScore ? <span className="field-error">{validationErrors.minimumScore}</span> : null}
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
