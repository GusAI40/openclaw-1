#!/usr/bin/env python3
"""Test Maya's brain end-to-end. Same model + system prompt + tool VAPI uses.
Sends natural-language user turns, watches Maya call the real tool endpoint, prints her replies."""
import os, json, sys, urllib.request, urllib.error

ANTHROPIC_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
TOOL_URL = 'https://openclaw.ubntag.com/vapi/tool'
ASSISTANT_ID = '701efa30-304b-4ddd-b6ec-a4818770389d'

# Pull the live system prompt + tool def from VAPI so we test what's actually deployed
def fetch_assistant():
    req = urllib.request.Request(
        f'https://api.vapi.ai/assistant/{ASSISTANT_ID}',
        headers={'Authorization': 'Bearer ' + os.environ['VAPI_PRIVATE_KEY']})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def call_tool(query):
    """Hit our real production tool endpoint."""
    payload = {'message': {'type': 'tool-calls', 'toolCallList': [
        {'id': 't', 'function': {'name': 'lookup_listing', 'arguments': json.dumps({'query': query})}}
    ]}}
    req = urllib.request.Request(TOOL_URL, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(json.loads(r.read())['results'][0]['result'])

def claude_call(messages, system, tools):
    body = {'model': 'claude-haiku-4-5-20251001', 'max_tokens': 400, 'system': system, 'tools': tools, 'messages': messages}
    req = urllib.request.Request('https://api.anthropic.com/v1/messages',
        data=json.dumps(body).encode(),
        headers={'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {'error': e.read().decode()}

def run_scenario(name, user_inputs, system, tools):
    print(f'\n{"="*60}\nSCENARIO: {name}\n{"="*60}')
    messages = []
    for user_msg in user_inputs:
        print(f'\n👤 USER: {user_msg}')
        messages.append({'role': 'user', 'content': user_msg})
        # loop: claude may want to use tool, then continue
        for hop in range(4):
            resp = claude_call(messages, system, tools)
            if resp.get('error'):
                print(f'  ❌ API error: {resp["error"][:200]}'); return
            content = resp.get('content', [])
            tool_uses = [b for b in content if b.get('type') == 'tool_use']
            text_blocks = [b['text'] for b in content if b.get('type') == 'text']
            if text_blocks:
                print(f'🤖 MAYA: {" ".join(text_blocks)}')
            messages.append({'role': 'assistant', 'content': content})
            if not tool_uses or resp.get('stop_reason') != 'tool_use':
                break
            tool_results = []
            for tu in tool_uses:
                q = tu['input'].get('query', '')
                print(f'  🔧 TOOL CALL: lookup_listing(query="{q}")')
                result = call_tool(q)
                summary = f'found={result.get("found")} count={result.get("count", 0)}'
                if result.get('properties'):
                    summary += ' first=' + result['properties'][0].get('address', '?')
                print(f'  📦 TOOL RESULT: {summary}')
                tool_results.append({'type': 'tool_result', 'tool_use_id': tu['id'], 'content': json.dumps(result)})
            messages.append({'role': 'user', 'content': tool_results})

# Get the real config
a = fetch_assistant()
system = a['model']['messages'][0]['content']
# Build Anthropic-format tool from VAPI tool def
vapi_tool = a['model']['tools'][0]['function']
tools = [{'name': vapi_tool['name'], 'description': vapi_tool['description'], 'input_schema': vapi_tool['parameters']}]

print(f'Loaded Maya config: {len(system)} char prompt, {len(tools)} tool(s)')

# Run several real-world natural-language scenarios
run_scenario('Drive-by Lantana lead', [
    'Hey, I saw your sign in Lantana Texas, can you tell me about homes there?',
    'What about Canyon Crossing? I think I drove by that one.',
    'Sounds great. My name is Tom, can you have Michelle text me at 555-123-4567?'
], system, tools)

run_scenario('Confused buyer with vague query', [
    'Hi I am calling about a house, I think it was on Bonham?',
], system, tools)

run_scenario('Argyle market browse', [
    'What homes are for sale in Argyle?',
], system, tools)

run_scenario('Out-of-area request (negative case)', [
    'I want to see homes in Beverly Hills California',
], system, tools)

print('\n' + '='*60 + '\nDONE.')
