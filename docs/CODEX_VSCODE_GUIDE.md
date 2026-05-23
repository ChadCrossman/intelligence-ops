# Using Codex in VS Code for this project

## Install

1. Open VS Code.
2. Open Extensions.
3. Search for `Codex`.
4. Install the OpenAI Codex extension.
5. Sign in using your ChatGPT account or API key.

## Open the project

Open the repository root folder:

```text
publish-weaver-intelligence-ops
```

Do not open only `apps/web` or only `apps/api`, because Codex needs the monorepo context.

## Recommended Codex modes

Use:

```text
Chat
```

for explanations, refactoring advice, and architecture questions.

Use:

```text
Agent
```

for contained coding tasks such as implementing a component, adding a route, or writing tests.

Use:

```text
Agent Full Access
```

only after you have committed your current work and are comfortable with Codex editing and running commands.

## Good first Codex tasks

```text
Read README.md, packages/shared/src/types.ts, apps/api/src/index.ts, and apps/web/src/App.tsx. Explain the architecture and identify the next safest implementation step.
```

```text
Add client-side validation to QueryEditor.tsx. Keep the validation rules simple and do not change API contracts.
```

```text
Replace the mock search provider with a Brave Search API adapter behind the existing SearchProvider interface. Add environment variable documentation but do not expose API keys in the frontend.
```

```text
Add PostgreSQL persistence behind the Storage interface. Keep the file-backed storage available as a local fallback.
```

```text
Add a results review page where I can mark retrieved articles as accepted, rejected, or selected for blog generation.
```

```text
Add tests for scoreArticle and generateBlogDraft. Keep test data deterministic.
```

## GIT

```shell
git init
git add -A
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:ChadCrossman/intelligence-ops.git
git push -u origin main
```

## Guardrails for Codex

Tell Codex:

```text
Do not put API keys in the frontend.
Do not tightly couple search, scoring, blog generation, and email generation.
Preserve the shared types in packages/shared unless the API and UI are updated together.
Keep the project Windows 11 compatible.
Do not introduce Docker.
Use pnpm.
Use TypeScript.
```

## Branch discipline

Recommended workflow:

```powershell
git checkout -b feature/postgres-storage
```

Ask Codex to make one contained change.

Then run:

```powershell
pnpm typecheck
pnpm build
```

Review the diff carefully before committing.

## Useful prompts

### Backend integration prompt

```text
Implement a real search provider for Brave Search API.

Constraints:
- Use the existing SearchProvider interface.
- Add a new braveSearchProvider.ts file.
- Keep mockSearchProvider.ts for local development.
- Select provider using SEARCH_PROVIDER=mock|brave.
- Read BRAVE_SEARCH_API_KEY from process.env.
- Never expose the key to the frontend.
- Update README.md with setup instructions.
- Keep Windows 11 and pnpm compatibility.
```

### PostgreSQL prompt

```text
Replace file-backed storage with PostgreSQL behind the Storage interface.

Constraints:
- Keep the Storage interface stable.
- Add schema SQL in docs/database/schema.sql.
- Add pg dependency only in apps/api.
- Select storage using STORAGE_PROVIDER=file|postgres.
- Keep file storage as default.
- Add .env.example entries.
- Do not use Docker.
```

### Blog generation prompt

```text
Implement a draft blog generation service using the OpenAI API.

Constraints:
- Use existing BlogDraft type.
- Add OPENAI_API_KEY to .env.example.
- Server-side only.
- The generated draft must include title, subtitle, summary, bodyMarkdown, sourceArticleIds, status=draft.
- Keep a human approval step before publishing or emailing.
```

### Email prompt

```text
Implement email synopsis generation and sending using Resend.

Constraints:
- Server-side only.
- Add RESEND_API_KEY and EMAIL_FROM to .env.example.
- Do not send automatically from a query run.
- Add a preview endpoint first.
- Keep manual approval before sending.
```
