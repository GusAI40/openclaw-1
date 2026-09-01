# Caddy site block for tenant {{TENANT_ID}} ({{TENANT_NAME}})
# Bootstrapped: {{NOW_ISO8601}}
# Reverse-proxies ONLY this tenant's gateway port — other tenants are unreachable from this hostname.
# Drop this file into /etc/caddy/Caddyfile.d/{{TENANT_ID}}.conf and `sudo systemctl reload caddy`.

{{DOMAIN}} {
    # VAPI webhook path — shared host-wide service on :18792
    # If you later split jarvis-vapi-webhook per-tenant, change this port to {{TENANT_ID}}'s vapi port.
    @vapi path /vapi/webhook /vapi/webhook/* /vapi/tool /vapi/tool/*
    handle @vapi {
        reverse_proxy 127.0.0.1:18792
    }

    # All other traffic -> this tenant's OpenClaw gateway
    handle {
        reverse_proxy 127.0.0.1:{{GATEWAY_PORT}}
        header {
            Strict-Transport-Security "max-age=31536000; includeSubDomains"
            X-Content-Type-Options "nosniff"
            X-Frame-Options "DENY"
            X-Tag-Tenant "{{TENANT_ID}}"
        }
    }

    log {
        output file /var/log/caddy/{{TENANT_ID}}.access.log
        format console
    }
}
