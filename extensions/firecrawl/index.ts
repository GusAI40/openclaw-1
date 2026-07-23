import { definePluginEntry, type AnyAgentTool } from "openclaw/plugin-sdk/plugin-entry";
import {
  createFirecrawlAgentCancelTool,
  createFirecrawlAgentStatusTool,
  createFirecrawlAgentTool,
} from "./src/firecrawl-agent-tools.js";
import { createFirecrawlWebFetchProvider } from "./src/firecrawl-fetch-provider.js";
import { createFirecrawlScrapeTool } from "./src/firecrawl-scrape-tool.js";
import { createFirecrawlWebSearchProvider } from "./src/firecrawl-search-provider.js";
import { createFirecrawlSearchTool } from "./src/firecrawl-search-tool.js";

export default definePluginEntry({
  id: "firecrawl",
  name: "Firecrawl Plugin",
  description: "Bundled Firecrawl search and scrape plugin",
  register(api) {
    api.registerWebFetchProvider(createFirecrawlWebFetchProvider());
    api.registerWebSearchProvider(createFirecrawlWebSearchProvider());
    api.registerTool(createFirecrawlSearchTool(api) as AnyAgentTool);
    api.registerTool(createFirecrawlScrapeTool(api) as AnyAgentTool);
    api.registerTool(createFirecrawlAgentTool(api) as AnyAgentTool);
    api.registerTool(createFirecrawlAgentStatusTool(api) as AnyAgentTool);
    api.registerTool(createFirecrawlAgentCancelTool(api) as AnyAgentTool);
  },
});
