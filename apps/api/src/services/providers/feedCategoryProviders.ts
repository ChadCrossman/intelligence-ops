import type { SearchProvider } from "../searchProvider.js";
import { envList } from "./envUtils.js";
import { mockSearchResults, shouldUseMockProvider } from "./mockProvider.js";
import { searchRssFeeds } from "./rssSearchProvider.js";

function createFeedCategoryProvider(name: string, envName: string): SearchProvider {
  return {
    name,

    async search(query) {
      const feeds = envList(envName);

      if (feeds.length === 0) {
        if (shouldUseMockProvider()) return mockSearchResults(name, query);
        throw new Error(`${envName} is required to run ${name}.`);
      }

      const results = await searchRssFeeds(feeds);

      if (results.length === 0 && shouldUseMockProvider()) {
        return mockSearchResults(name, query);
      }

      return results;
    }
  };
}

export const regulatoryFeedsProvider = createFeedCategoryProvider("regulatory feeds", "REGULATORY_FEED_URLS");
export const governanceBlogsProvider = createFeedCategoryProvider("governance blogs", "GOVERNANCE_BLOG_FEED_URLS");
export const vendorBlogsProvider = createFeedCategoryProvider("vendor blogs", "VENDOR_BLOG_FEED_URLS");
