import { v4 as uuid } from "uuid";
import type { BlogDraft, EmailCampaign } from "@pwio/shared";

export function generateEmailSynopsis(blogDrafts: BlogDraft[]): EmailCampaign {
  return {
    id: uuid(),
    subject: "New AI Governance Insights from Publish Weaver",
    synopsisMarkdown: [
      "# Latest AI Governance Insights",
      "",
      "Here are the latest draft articles prepared from the monitoring pipeline.",
      "",
      ...blogDrafts.map((draft) => `- **${draft.title}**: ${draft.summary}`),
      "",
      "Review and approve before sending to subscribers."
    ].join("\n"),
    blogDraftIds: blogDrafts.map((draft) => draft.id),
    status: "draft",
    createdAt: new Date().toISOString()
  };
}
