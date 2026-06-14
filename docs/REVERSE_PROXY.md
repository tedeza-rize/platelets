# Reverse Proxy Deployment

Platelets can run behind Nginx, Apache, a load balancer, or an edge proxy when
the proxy preserves client identity, original host/protocol, and streaming
responses. Review this checklist before exposing a deployment.

## Required Behavior

1. Forward the client IP.
   `src/lib/rate-limit.ts` keys the in-process limiter by the first
   `X-Forwarded-For` value, then `X-Real-IP`, then `local`. If a proxy omits
   those headers, all users can appear as one proxy IP and one user's traffic
   can throttle the entire site.

2. Forward original host and protocol.
   Next.js route handlers and redirects need the public request context. Send
   `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto` from the edge.

3. Disable buffering for `/api/disaster/events`.
   The dashboard event stream uses Server-Sent Events, not WebSockets. Proxies
   must avoid response buffering and keep the read timeout long enough for an
   idle operator dashboard.

4. Keep writable SQLite deployments single-instance.
   Incident events are published through an in-process event hub, and SQLite
   writes are serialized by an in-process queue. Use one sticky writable Node.js
   process until Redis/PostgreSQL or another shared broker/database is added.

5. Terminate HTTP at HTTPS.
   Public deployments should redirect port 80 to HTTPS. AI proxy URLs are
   validated as HTTPS-only, and operator sessions should not cross plain HTTP.

## Nginx Example

```nginx
server {
    listen 80;
    server_name platelets.example.kr;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name platelets.example.kr;

    ssl_certificate /etc/letsencrypt/live/platelets.example.kr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/platelets.example.kr/privkey.pem;

    location /api/disaster/events {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;

        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Apache Example

Enable `mod_proxy`, `mod_proxy_http`, `mod_headers`, `mod_ssl`, and
`mod_rewrite`.

```apache
<VirtualHost *:80>
    ServerName platelets.example.kr
    RewriteEngine On
    RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
</VirtualHost>

<VirtualHost *:443>
    ServerName platelets.example.kr

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/platelets.example.kr/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/platelets.example.kr/privkey.pem

    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Host "%{Host}i"
    RequestHeader append X-Forwarded-For "%{REMOTE_ADDR}s"
    RequestHeader set X-Real-IP "%{REMOTE_ADDR}s"

    ProxyPass /api/disaster/events http://127.0.0.1:3000/api/disaster/events flushpackets=on retry=0 timeout=86400
    ProxyPassReverse /api/disaster/events http://127.0.0.1:3000/api/disaster/events

    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
</VirtualHost>
```

## Load Balancing Notes

- Keep `/api/disaster/events` and write routes on the same single writable
  instance unless an external event broker is introduced.
- Keep `PLATELETS_SQLITE_WRITE_MODE=single-process` only for verified
  single-process deployments with persistent disk ownership.
- Put rate limiting at the proxy or edge when multiple app processes serve
  public traffic; the application limiter is process-local.
