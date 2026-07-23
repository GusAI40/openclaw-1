import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-runtime";
import {
  jsonResult,
  readNumberParam,
  readStringArrayParam,
  readStringParam,
} from "openclaw/plugin-sdk/provider-web-search";
import { Type } from "typebox";
import {
  cancelFirecrawlAgent,
  getFirecrawlAgentStatus,
  startFirecrawlAgent,
  type FirecrawlAgentModel,
} from "./firecrawl-client.js";

function optionalStringEnum<const T extends readonly string[]>(
  values: T,
  options: { description?: string } = {},
) {
  return Type.Optional(
    Type.Unsafe<T[number]>({
      type: "string",
      enum: [...values],
      ...options,
    }),
  );
}

function readJsonObjectParam(
  params: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = params[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readFirecrawlAgentModel(params: Record<string, unknown>): FirecrawlAgentModel | undefined {
  const model = readStringParam(params, "model");
  return model === "spark-1-mini" || model === "spark-1-pro" ? model : undefined;
}

const FirecrawlAgentToolSchema = Type.Object(
  {
    prompt: Type.String({
      description: "Natural language description of the web data to gather.",
      maxLength: 10_000,
    }),
    urls: Type.Optional(
      Type.Array(Type.String(), {
        description: "Optional URLs to focus the Firecrawl Agent on.",
      }),
    ),
    schema: Type.Optional(
      Type.Record(Type.String(), Type.Unknown(), {
        description: "Optional JSON Schema for structured extraction output.",
      }),
    ),
    maxCredits: Type.Optional(
      Type.Number({
        description: "Maximum Firecrawl credits to spend on this agent job.",
        minimum: 1,
      }),
    ),
    strictConstrainToURLs: Type.Optional(
      Type.Boolean({
        description: "Only allow the Firecrawl Agent to visit URLs provided in urls.",
      }),
    ),
    model: optionalStringEnum(["spark-1-mini", "spark-1-pro"] as const, {
      description: "Firecrawl Agent model. Default: spark-1-mini.",
    }),
    timeoutSeconds: Type.Optional(
      Type.Number({
        description: "Timeout in seconds for starting the Firecrawl Agent job.",
        minimum: 1,
      }),
    ),
  },
  { additionalProperties: false },
);

const FirecrawlAgentJobToolSchema = Type.Object(
  {
    jobId: Type.String({ description: "Firecrawl Agent job UUID." }),
    timeoutSeconds: Type.Optional(
      Type.Number({
        description: "Timeout in seconds for the Firecrawl Agent job request.",
        minimum: 1,
      }),
    ),
  },
  { additionalProperties: false },
);

export function createFirecrawlAgentTool(api: OpenClawPluginApi) {
  return {
    name: "firecrawl_agent",
    label: "Firecrawl Agent",
    description:
      "Start a Firecrawl /v2/agent job for agentic web data extraction. Returns a job id; use firecrawl_agent_status to retrieve results.",
    parameters: FirecrawlAgentToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      return jsonResult(
        await startFirecrawlAgent({
          cfg: api.config,
          prompt: readStringParam(rawParams, "prompt", { required: true }),
          urls: readStringArrayParam(rawParams, "urls"),
          schema: readJsonObjectParam(rawParams, "schema"),
          maxCredits: readNumberParam(rawParams, "maxCredits", { integer: true }),
          strictConstrainToURLs:
            typeof rawParams.strictConstrainToURLs === "boolean"
              ? rawParams.strictConstrainToURLs
              : undefined,
          model: readFirecrawlAgentModel(rawParams),
          timeoutSeconds: readNumberParam(rawParams, "timeoutSeconds", {
            integer: true,
          }),
        }),
      );
    },
  };
}

export function createFirecrawlAgentStatusTool(api: OpenClawPluginApi) {
  return {
    name: "firecrawl_agent_status",
    label: "Firecrawl Agent Status",
    description:
      "Get Firecrawl /v2/agent job status and extracted data when the job is completed.",
    parameters: FirecrawlAgentJobToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      return jsonResult(
        await getFirecrawlAgentStatus({
          cfg: api.config,
          jobId: readStringParam(rawParams, "jobId", { required: true }),
          timeoutSeconds: readNumberParam(rawParams, "timeoutSeconds", {
            integer: true,
          }),
        }),
      );
    },
  };
}

export function createFirecrawlAgentCancelTool(api: OpenClawPluginApi) {
  return {
    name: "firecrawl_agent_cancel",
    label: "Firecrawl Agent Cancel",
    description: "Cancel a running Firecrawl /v2/agent job.",
    parameters: FirecrawlAgentJobToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      return jsonResult(
        await cancelFirecrawlAgent({
          cfg: api.config,
          jobId: readStringParam(rawParams, "jobId", { required: true }),
          timeoutSeconds: readNumberParam(rawParams, "timeoutSeconds", {
            integer: true,
          }),
        }),
      );
    },
  };
}
