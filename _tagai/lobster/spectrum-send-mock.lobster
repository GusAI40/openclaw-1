# spectrum-send-mock.lobster
#
# Proof-of-pattern Lobster pipeline for the Spectrum Enterprise outreach lane.
# Shape mirrors the real spectrum-send Claude Code skill, but pull/send/log
# are MOCK so we can validate the approval gate without touching prod data.
#
# Real version (v2) replaces:
#   pull_contacts -> Supabase REST query against spectrum_gus_module_prospects_*
#   send          -> POST to https://outlook.office.com/api/v2.0/me/sendmail
#                    with OWA bearer token (captured locally, uploaded to server)
#   log           -> INSERT into spectrum_gus_module_prospects_touches via Supabase
#
# Standing Order honored at runtime: `approval: required` halts before any
# external side-effect, returns a resumeToken. Cannot be bypassed by prompt
# injection or hallucination — the runtime enforces it.

name: spectrum-send-mock
args:
  count:
    default: "3"

steps:
  - id: pull_contacts
    # MOCK contacts. Real version: Supabase MCP query.
    command: >-
      echo '{"contacts":[
        {"account":"Acme Manufacturing","name":"Alice Brown","title":"COO","email":"alice@acme.example","industry":"manufacturing","angle":"business_continuity"},
        {"account":"Beta AI Labs","name":"Bob Chen","title":"CTO","email":"bob@beta.example","industry":"ai","angle":"ai_infrastructure"},
        {"account":"Gamma Hospitality","name":"Carla Diaz","title":"VP Operations","email":"carla@gamma.example","industry":"hospitality","angle":"hospitality"}
      ]}'

  - id: draft_emails
    # REAL LLM call via llm-task. Drafts 3 v6-tone emails as structured JSON.
    command: >-
      openclaw.invoke --tool llm-task --action json --args-json '{"prompt":"For each contact in the input JSON, write a personalized Spectrum Enterprise outreach email following the v6 tone: three short paragraphs, conversational, open with I work with [industry] companies to help them..., acknowledge the role and company situation, include one Learn more here link masked (do not show raw URL), close with Let me know the best time to talk. Sign as Gus Sanchez. Return one draft per contact.","thinking":"low","schema":{"type":"object","properties":{"drafts":{"type":"array","items":{"type":"object","properties":{"to":{"type":"string"},"account":{"type":"string"},"subject":{"type":"string"},"body":{"type":"string"},"angle":{"type":"string"}},"required":["to","account","subject","body","angle"],"additionalProperties":false}}},"required":["drafts"],"additionalProperties":false}}'
    stdin: $pull_contacts.stdout

  - id: gate
    # HARD GATE per Standing Order Scope Discipline. Runtime-enforced.
    # Returns resumeToken; pipeline halts until {action:"resume", approve:true|false}.
    command: 'echo {"gated":true}'
    stdin: $draft_emails.stdout
    approval: required

  - id: send
    # MOCK send. Real version: POST to OWA sendmail with bearer token.
    # 30s delay between sends, BCC Salesforce + Gustavo, abort batch on 401.
    command: 'echo {"status":"would_send","note":"v2 swap-in: real OWA POST"}'
    stdin: $draft_emails.stdout
    condition: $gate.approved

  - id: log
    # MOCK log. Real version: INSERT into spectrum_gus_module_prospects_touches.
    command: 'echo {"status":"would_log","note":"v2 swap-in: real Supabase INSERT"}'
    stdin: $send.stdout
    condition: $gate.approved
