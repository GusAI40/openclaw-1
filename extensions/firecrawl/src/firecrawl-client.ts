import type { OpenClawConfig } from "openclaw/plugin-sdk/config-runtime";
import {
  DEFAULT_CACHE_TTL_MINUTES,
  markdownToText,
  normalizeCacheKey,
  readCache,
  readResponseText,
  resolveCacheTtlMs,
  truncateText,
  withStrictWebToolsEndpoint,
  writeCache,
} from "openclaw/plugin-sdk/provider-web-fetch";
import { normalizeSecretInput } from "openclaw/plugin-sdk/secret-input";
import { wrapExternalContent, wrapWebContent } from "openclaw/plugin-sdk/security-runtime";
import {
  resolveFirecrawlApiKey,
  resolveFirecrawlBaseUrl,
  resolveFirecrawlAgentTimeoutSeconds,
  resolveFirecrawlMaxAgeMs,
  resolveFirecrawlOnlyMainContent,
  resolveFirecrawlScrapeTimeoutSeconds,
  resolveFirecrawlSearchTimeoutSeconds,
} from "./config.js";

const SEARCH_CACHE = new Map<
  string,
  { value: Record<string, unknown>; expiresAt: number; insertedAt: number }
>();
const SCRAPE_CACHE = new Map<
  string,
  { value: Record<string, unknown>; expiresAt: number; insertedAt: number }
>();
const DEFAULT_SEARCH_COUNT = 5;
const DEFAULT_SCRAPE_MAX_CHARS = 50_000;
const ALLOWED_FIRECRAWL_HOSTS = new Set(["api.firecrawl.dev"]);
const FIRECRAWL_AGENT_JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type FirecrawlSearchItem = {
  title: string;
  url: string;
  description?: string;
  content?: string;
  published?: string;
  siteName?: string;
};

export type FirecrawlSearchParams = {
  cfg?: OpenClawConfig;
  query: string;
  count?: number;
  timeoutSeconds?: number;
  sources?: string[];
  categories?: string[];
  scrapeResults?: boolean;
};

export type FirecrawlScrapeParams = {
  cfg?: OpenClawConfig;
  url: string;
  extractMode: "markdown" | "text";
  maxChars?: number;
  onlyMainContent?: boolean;
  maxAgeMs?: number;
  proxy?: "auto" | "basic" | "stealth";
  storeInCache?: boolean;
  timeoutSeconds?: number;
};

export type FirecrawlAgentModel = "spark-1-mini" | "spark-1-pro";

export type FirecrawlAgentStartParams = {
  cfg?: OpenClawConfig;
  prompt: string;
  urls?: string[];
  schema?: Record<string, unknown>;
  maxCredits?: number;
  strictConstrainToURLs?: boolean;
  model?: FirecrawlAgentModel;
  timeoutSeconds?: number;
};

export type FirecrawlAgentJobParams = {
  cfg?: OpenClawConfig;
  jobId: string;
  timeoutSeconds?: number;
};

function resolveEndpoint(
  baseUrl: string,
  pathname: "/v2/search" | "/v2/scrape" | "/v2/agent",
): string {
  const url = new URL(baseUrl.trim() || "https://api.firecrawl.dev");
  if (url.protocol !== "https:") {
    throw new Error("Firecrawl baseUrl must use https.");
  }
  if (!ALLOWED_FIRECRAWL_HOSTS.has(url.hostname)) {
    throw new Error(`Firecrawl baseUrl host is not allowed: ${url.hostname}`);
  }
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  url.pathname = pathname;
  return url.toString();
}

function normalizeFirecrawlAgentJobId(jobId: string): string {
  const normalized = jobId.trim();
  if (!FIRECRAWL_AGENT_JOB_ID_PATTERN.test(normalized)) {
    throw new Error("Firecrawl agent jobId must be a UUID.");
  }
  return normalized;
}

function resolveAgentJobEndpoint(baseUrl: string, jobId: string): string {
  const normalizedJobId = normalizeFirecrawlAgentJobId(jobId);
  const url = new URL(resolveEndpoint(baseUrl, "/v2/agent"));
  url.pathname = `/v2/agent/${encodeURIComponent(normalizedJobId)}`;
  return url.toString();
}

async function postFirecrawlJson<T>(
  params: {
    url: string;
    timeoutSeconds: number;
    apiKey: string;
    body: Record<string, unknown>;
    errorLabel: string;
  },
  parse: (response: Response) => Promise<T>,
): Promise<T> {
  const apiKey = normalizeSecretInput(params.apiKey);
  return await withStrictWebToolsEndpoint(
    {
      url: params.url,
      timeoutSeconds: params.timeoutSeconds,
      init: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params.body),
      },
    },
    async ({ response }) => {
      if (!response.ok) {
        let detail =
          typeof response.statusText === "string" && response.statusText.trim()
            ? response.statusText.trim()
            : "request failed";

        const readJsonPayload = async (): Promise<Record<string, unknown> | null> => {
          const candidate = response as Response & { clone?: () => Response };
          const jsonResponse = typeof candidate.clone === "function" ? candidate.clone() : response;
          if (typeof jsonResponse.json !== "function") {
            return null;
          }
          try {
            const payload = await jsonResponse.json();
            return payload && typeof payload === "object" && !Array.isArray(payload)
              ? (payload as Record<string, unknown>)
              : null;
          } catch {
            return null;
          }
        };

        const payload = await readJsonPayload();
        if (payload) {
          detail =
            typeof payload.error === "string"
              ? payload.error
              : typeof payload.message === "string"
                ? payload.message
                : detail;
        } else {
          const errorBody = await readResponseText(response, { maxBytes: 64_000 });
          if (errorBody.text) {
            detail = errorBody.text;
          }
        }
        const safeDetail = wrapWebContent(detail.slice(0, 1_000), "web_fetch");
        throw new Error(`${params.errorLabel} API error (${response.status}): ${safeDetail}`);
      }
      return await parse(response);
    },
  );
}

async function requestFirecrawlJson<T>(
  params: {
    method: "GET" | "DELETE";
    url: string;
    timeoutSeconds: number;
    apiKey: string;
    errorLabel: string;
  },
  parse: (response: Response) => Promise<T>,
): Promise<T> {
  const apiKey = normalizeSecretInput(params.apiKey);
  return await withStrictWebToolsEndpoint(
    {
      url: params.url,
      timeoutSeconds: params.timeoutSeconds,
      init: {
        method: params.method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    },
    async ({ response }) => {
      if (!response.ok) {
        const errorBody = await readResponseText(response, { maxBytes: 64_000 });
        const detail = errorBody.text || response.statusText || "request failed";
        throw new Error(
          `${params.errorLabel} API error (${response.status}): ${wrapWebContent(
            detail.slice(0, 1_000),
            "web_fetch",
          )}`,
        );
      }
      return await parse(response);
    },
  );
}

function resolveSiteName(urlRaw: string): string | undefined {
  try {
    const host = new URL(urlRaw).hostname.replace(/^www\./, "");
    return host || undefined;
  } catch {
    return undefined;
  }
}

function resolveSearchItems(payload: Record<string, unknown>): FirecrawlSearchItem[] {
  const candidates = [
    payload.data,
    payload.results,
    (payload.data as { results?: unknown } | undefined)?.results,
    (payload.data as { data?: unknown } | undefined)?.data,
    (payload.data as { web?: unknown } | undefined)?.web,
    (payload.web as { results?: unknown } | undefined)?.results,
  ];
  const rawItems = candidates.find((candidate) => Array.isArray(candidate));
  if (!Array.isArray(rawItems)) {
    return [];
  }
  const items: FirecrawlSearchItem[] = [];
  for (const entry of rawItems) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const metadata =
      record.metadata && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>)
        : undefined;
    const url =
      (typeof record.url === "string" && record.url) ||
      (typeof record.sourceURL === "string" && record.sourceURL) ||
      (typeof record.sourceUrl === "string" && record.sourceUrl) ||
      (typeof metadata?.sourceURL === "string" && metadata.sourceURL) ||
      "";
    if (!url) {
      continue;
    }
    const title =
      (typeof record.title === "string" && record.title) ||
      (typeof metadata?.title === "string" && metadata.title) ||
      "";
    const description =
      (typeof record.description === "string" && record.description) ||
      (typeof record.snippet === "string" && record.snippet) ||
      (typeof record.summary === "string" && record.summary) ||
      undefined;
    const content =
      (typeof record.markdown === "string" && record.markdown) ||
      (typeof record.content === "string" && record.content) ||
      (typeof record.text === "string" && record.text) ||
      undefined;
    const published =
      (typeof record.publishedDate === "string" && record.publishedDate) ||
      (typeof record.published === "string" && record.published) ||
      (typeof metadata?.publishedTime === "string" && metadata.publishedTime) ||
      (typeof metadata?.publishedDate === "string" && metadata.publishedDate) ||
      undefined;
    items.push({
      title,
      url,
      description,
      content,
      published,
      siteName: resolveSiteName(url),
    });
  }
  return items;
}

function buildSearchPayload(params: {
  query: string;
  provider: "firecrawl";
  items: FirecrawlSearchItem[];
  tookMs: number;
  scrapeResults: boolean;
}): Record<string, unknown> {
  return {
    query: params.query,
    provider: params.provider,
    count: params.items.length,
    tookMs: params.tookMs,
    externalContent: {
      untrusted: true,
      source: "web_search",
      provider: params.provider,
      wrapped: true,
    },
    results: params.items.map((entry) => ({
      title: entry.title ? wrapWebContent(entry.title, "web_search") : "",
      url: entry.url,
      description: entry.description ? wrapWebContent(entry.description, "web_search") : "",
      ...(entry.published ? { published: entry.published } : {}),
      ...(entry.siteName ? { siteName: entry.siteName } : {}),
      ...(params.scrapeResults && entry.content
        ? { content: wrapWebContent(entry.content, "web_search") }
        : {}),
    })),
  };
}

export async function runFirecrawlSearch(
  params: FirecrawlSearchParams,
): Promise<Record<string, unknown>> {
  const apiKey = resolveFirecrawlApiKey(params.cfg);
  if (!apiKey) {
    throw new Error(
      "web_search (firecrawl) needs a Firecrawl API key. Set FIRECRAWL_API_KEY in the Gateway environment, or configure plugins.entries.firecrawl.config.webSearch.apiKey.",
    );
  }
  const count =
    typeof params.count === "number" && Number.isFinite(params.count)
      ? Math.max(1, Math.min(10, Math.floor(params.count)))
      : DEFAULT_SEARCH_COUNT;
  const timeoutSeconds = resolveFirecrawlSearchTimeoutSeconds(params.timeoutSeconds);
  const scrapeResults = params.scrapeResults === true;
  const sources = Array.isArray(params.sources) ? params.sources.filter(Boolean) : [];
  const categories = Array.isArray(params.categories) ? params.categories.filter(Boolean) : [];
  const baseUrl = resolveFirecrawlBaseUrl(params.cfg);
  const cacheKey = normalizeCacheKey(
    JSON.stringify({
      type: "firecrawl-search",
      q: params.query,
      count,
      baseUrl,
      sources,
      categories,
      scrapeResults,
    }),
  );
  const cached = readCache(SEARCH_CACHE, cacheKey);
  if (cached) {
    return { ...cached.value, cached: true };
  }

  const body: Record<string, unknown> = {
    query: params.query,
    limit: count,
  };
  if (sources.length > 0) {
    body.sources = sources;
  }
  if (categories.length > 0) {
    body.categories = categories;
  }
  if (scrapeResults) {
    body.scrapeOptions = {
      formats: ["markdown"],
    };
  }

  const start = Date.now();
  const payload = await postFirecrawlJson(
    {
      url: resolveEndpoint(baseUrl, "/v2/search"),
      timeoutSeconds,
      apiKey,
      body,
      errorLabel: "Firecrawl Search",
    },
    async (response) => {
      const payload = (await response.json()) as Record<string, unknown>;
      if (payload.success === false) {
        const error =
          typeof payload.error === "string"
            ? payload.error
            : typeof payload.message === "string"
              ? payload.message
              : "unknown error";
        throw new Error(`Firecrawl Search API error: ${error}`);
      }
      return payload;
    },
  );
  const result = buildSearchPayload({
    query: params.query,
    provider: "firecrawl",
    items: resolveSearchItems(payload),
    tookMs: Date.now() - start,
    scrapeResults,
  });
  writeCache(
    SEARCH_CACHE,
    cacheKey,
    result,
    resolveCacheTtlMs(undefined, DEFAULT_CACHE_TTL_MINUTES),
  );
  return result;
}

function resolveScrapeData(payload: Record<string, unknown>): Record<string, unknown> {
  const data = payload.data;
  if (data && typeof data === "object") {
    return data as Record<string, unknown>;
  }
  return {};
}

export function parseFirecrawlScrapePayload(params: {
  payload: Record<string, unknown>;
  url: string;
  extractMode: "markdown" | "text";
  maxChars: number;
}): Record<string, unknown> {
  const data = resolveScrapeData(params.payload);
  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : undefined;
  const markdown =
    (typeof data.markdown === "string" && data.markdown) ||
    (typeof data.content === "string" && data.content) ||
    "";
  if (!markdown) {
    throw new Error("Firecrawl scrape returned no content.");
  }
  const rawText = params.extractMode === "text" ? markdownToText(markdown) : markdown;
  const truncated = truncateText(rawText, params.maxChars);
  return {
    url: params.url,
    finalUrl:
      (typeof metadata?.sourceURL === "string" && metadata.sourceURL) ||
      (typeof data.url === "string" && data.url) ||
      params.url,
    status:
      (typeof metadata?.statusCode === "number" && metadata.statusCode) ||
      (typeof data.statusCode === "number" && data.statusCode) ||
      undefined,
    title:
      typeof metadata?.title === "string" && metadata.title
        ? wrapExternalContent(metadata.title, { source: "web_fetch", includeWarning: false })
        : undefined,
    extractor: "firecrawl",
    extractMode: params.extractMode,
    externalContent: {
      untrusted: true,
      source: "web_fetch",
      wrapped: true,
    },
    truncated: truncated.truncated,
    rawLength: rawText.length,
    wrappedLength: wrapExternalContent(truncated.text, {
      source: "web_fetch",
      includeWarning: false,
    }).length,
    text: wrapExternalContent(truncated.text, {
      source: "web_fetch",
      includeWarning: false,
    }),
    warning:
      typeof params.payload.warning === "string" && params.payload.warning
        ? wrapExternalContent(params.payload.warning, {
            source: "web_fetch",
            includeWarning: false,
          })
        : undefined,
  };
}

export async function runFirecrawlScrape(
  params: FirecrawlScrapeParams,
): Promise<Record<string, unknown>> {
  const apiKey = resolveFirecrawlApiKey(params.cfg);
  if (!apiKey) {
    throw new Error(
      "firecrawl_scrape needs a Firecrawl API key. Set FIRECRAWL_API_KEY in the Gateway environment, or configure plugins.entries.firecrawl.config.webFetch.apiKey.",
    );
  }
  const baseUrl = resolveFirecrawlBaseUrl(params.cfg);
  const timeoutSeconds = resolveFirecrawlScrapeTimeoutSeconds(params.cfg, params.timeoutSeconds);
  const onlyMainContent = resolveFirecrawlOnlyMainContent(params.cfg, params.onlyMainContent);
  const maxAgeMs = resolveFirecrawlMaxAgeMs(params.cfg, params.maxAgeMs);
  const proxy = params.proxy ?? "auto";
  const storeInCache = params.storeInCache ?? true;
  const maxChars =
    typeof params.maxChars === "number" && Number.isFinite(params.maxChars) && params.maxChars > 0
      ? Math.floor(params.maxChars)
      : DEFAULT_SCRAPE_MAX_CHARS;
  const cacheKey = normalizeCacheKey(
    JSON.stringify({
      type: "firecrawl-scrape",
      url: params.url,
      extractMode: params.extractMode,
      baseUrl,
      onlyMainContent,
      maxAgeMs,
      proxy,
      storeInCache,
      maxChars,
    }),
  );
  const cached = readCache(SCRAPE_CACHE, cacheKey);
  if (cached) {
    return { ...cached.value, cached: true };
  }

  const payload = await postFirecrawlJson(
    {
      url: resolveEndpoint(baseUrl, "/v2/scrape"),
      timeoutSeconds,
      apiKey,
      errorLabel: "Firecrawl",
      body: {
        url: params.url,
        formats: ["markdown"],
        onlyMainContent,
        timeout: timeoutSeconds * 1000,
        maxAge: maxAgeMs,
        proxy,
        storeInCache,
      },
    },
    async (response) => {
      const payload = (await response.json()) as Record<string, unknown>;
      if (payload.success === false) {
        const detail =
          typeof payload.error === "string"
            ? payload.error
            : typeof payload.message === "string"
              ? payload.message
              : response.statusText;
        throw new Error(
          `Firecrawl fetch failed (${response.status}): ${wrapWebContent(detail, "web_fetch")}`.trim(),
        );
      }
      return payload;
    },
  );
  const result = parseFirecrawlScrapePayload({
    payload,
    url: params.url,
    extractMode: params.extractMode,
    maxChars,
  });
  writeCache(
    SCRAPE_CACHE,
    cacheKey,
    result,
    resolveCacheTtlMs(undefined, DEFAULT_CACHE_TTL_MINUTES),
  );
  return result;
}

function normalizeFirecrawlAgentPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {
    success: payload.success !== false,
  };
  for (const key of ["id", "status", "model", "expiresAt", "creditsUsed"]) {
    const value = payload[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      result[key] = value;
    }
  }
  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    result.data = payload.data;
  }
  if (typeof payload.error === "string" && payload.error) {
    result.error = wrapWebContent(payload.error, "web_fetch");
  }
  return result;
}

export async function startFirecrawlAgent(
  params: FirecrawlAgentStartParams,
): Promise<Record<string, unknown>> {
  const apiKey = resolveFirecrawlApiKey(params.cfg);
  if (!apiKey) {
    throw new Error(
      "firecrawl_agent needs a Firecrawl API key. Set FIRECRAWL_API_KEY in the Gateway environment, or configure plugins.entries.firecrawl.config.webSearch.apiKey.",
    );
  }
  const urls = Array.isArray(params.urls) ? params.urls.filter(Boolean) : [];
  const body: Record<string, unknown> = {
    prompt: params.prompt,
  };
  if (urls.length > 0) {
    body.urls = urls;
  }
  if (params.schema && Object.keys(params.schema).length > 0) {
    body.schema = params.schema;
  }
  if (
    typeof params.maxCredits === "number" &&
    Number.isFinite(params.maxCredits) &&
    params.maxCredits > 0
  ) {
    body.maxCredits = Math.floor(params.maxCredits);
  }
  if (typeof params.strictConstrainToURLs === "boolean") {
    body.strictConstrainToURLs = params.strictConstrainToURLs;
  }
  if (params.model === "spark-1-pro" || params.model === "spark-1-mini") {
    body.model = params.model;
  }

  const payload = await postFirecrawlJson(
    {
      url: resolveEndpoint(resolveFirecrawlBaseUrl(params.cfg), "/v2/agent"),
      timeoutSeconds: resolveFirecrawlAgentTimeoutSeconds(params.cfg, params.timeoutSeconds),
      apiKey,
      body,
      errorLabel: "Firecrawl Agent",
    },
    async (response) => (await response.json()) as Record<string, unknown>,
  );
  if (payload.success === false) {
    const detail =
      typeof payload.error === "string"
        ? payload.error
        : typeof payload.message === "string"
          ? payload.message
          : "unknown error";
    throw new Error(`Firecrawl Agent API error: ${wrapWebContent(detail, "web_fetch")}`);
  }
  return normalizeFirecrawlAgentPayload(payload);
}

export async function getFirecrawlAgentStatus(
  params: FirecrawlAgentJobParams,
): Promise<Record<string, unknown>> {
  const apiKey = resolveFirecrawlApiKey(params.cfg);
  if (!apiKey) {
    throw new Error(
      "firecrawl_agent_status needs a Firecrawl API key. Set FIRECRAWL_API_KEY in the Gateway environment, or configure plugins.entries.firecrawl.config.webSearch.apiKey.",
    );
  }
  const payload = await requestFirecrawlJson(
    {
      method: "GET",
      url: resolveAgentJobEndpoint(resolveFirecrawlBaseUrl(params.cfg), params.jobId),
      timeoutSeconds: resolveFirecrawlAgentTimeoutSeconds(params.cfg, params.timeoutSeconds),
      apiKey,
      errorLabel: "Firecrawl Agent Status",
    },
    async (response) => (await response.json()) as Record<string, unknown>,
  );
  return normalizeFirecrawlAgentPayload(payload);
}

export async function cancelFirecrawlAgent(
  params: FirecrawlAgentJobParams,
): Promise<Record<string, unknown>> {
  const apiKey = resolveFirecrawlApiKey(params.cfg);
  if (!apiKey) {
    throw new Error(
      "firecrawl_agent_cancel needs a Firecrawl API key. Set FIRECRAWL_API_KEY in the Gateway environment, or configure plugins.entries.firecrawl.config.webSearch.apiKey.",
    );
  }
  const payload = await requestFirecrawlJson(
    {
      method: "DELETE",
      url: resolveAgentJobEndpoint(resolveFirecrawlBaseUrl(params.cfg), params.jobId),
      timeoutSeconds: resolveFirecrawlAgentTimeoutSeconds(params.cfg, params.timeoutSeconds),
      apiKey,
      errorLabel: "Firecrawl Agent Cancel",
    },
    async (response) => (await response.json()) as Record<string, unknown>,
  );
  return normalizeFirecrawlAgentPayload(payload);
}

export const __testing = {
  normalizeFirecrawlAgentPayload,
  parseFirecrawlScrapePayload,
  postFirecrawlJson,
  requestFirecrawlJson,
  resolveAgentJobEndpoint,
  resolveEndpoint,
  resolveSearchItems,
};
