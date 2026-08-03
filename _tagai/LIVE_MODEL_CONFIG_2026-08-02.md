# Live OpenClaw Model Configuration - 2026-08-02

This note records the live LLM model configuration observed on the TAG AI VPS.

Source of truth checked:

- `openclaw models status --json`
- `openclaw models list --json`
- Live Docker containers on `tagai-cloud`
- OpenClaw docs: `docs/cli/models.md`

No provider probes were run. This confirms configured and available runtime model state, not a paid test call to each provider.

## Gus / Main OpenClaw

Container:

- `openclaw-openclaw-gateway-1`

Primary LLM:

- `openai/gpt-4o-mini`

Fallback order:

1. `mistral/mistral-large-latest`
2. `mistral/codestral-latest`
3. `openrouter/auto`

Other configured models available in the live model list:

- `openrouter/x-ai/grok-4-fast`
- `deepseek/deepseek-v4-pro`

## Julian OpenClaw

Container:

- `openclaw-julian-gateway`

Primary LLM:

- `deepseek/deepseek-v4-pro`

Fallback order:

1. `deepseek/deepseek-v4-flash`
2. `google/gemini-2.5-flash-lite`
3. `anthropic/claude-haiku-4-5`
4. `anthropic/claude-sonnet-4-6`

## Plain-English Summary

Think of each OpenClaw gateway as a dispatch office.

- The primary model is the first worker called for normal jobs.
- The fallback models are backup workers called if the first worker is unavailable or cannot handle the job.
- Gus currently routes first to OpenAI GPT-4o mini.
- Julian currently routes first to DeepSeek V4 Pro.

## Operational Notes

- Secrets were not printed or committed while collecting this information.
- Model auth exists through stored profiles or environment variables, but plaintext secret storage was already flagged in the VPS audit and should still be remediated.
- If model settings change on the VPS, rerun `openclaw models status --json` inside each gateway container and update this note.
