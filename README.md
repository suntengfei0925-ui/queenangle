# QueenAngle Independent Web

QueenAngle is now organized as an independent mobile-first Web application. This repository contains only the Web runtime:

- `server/` - Node.js API, authentication, SQLite document store, file upload routes
- `web/` - mobile Web client served by the Node app
- `deploy/` - Caddy and production environment templates
- `scripts/` - backup, restore, and health check scripts
- `docs/` - Web deployment and remaining business documentation

The legacy WeChat mini program source has been separated to:

```text
D:\queenangle-wechat-miniprogram-legacy
```

## Local Development

Local Docker runs the app on:

```text
http://127.0.0.1:3000
```

Start or rebuild:

```bash
docker compose up -d --build
```

Check status:

```bash
docker compose ps
```

Default local accounts are configured in `.env`:

```text
owner / owner123456
partner / partner123456
```

Change these before any production deployment.

## Data

Local runtime data is not committed:

```text
data/queenangle.sqlite
uploads/
```

Inside Docker these are mounted as:

```text
/data/db/queenangle.sqlite
/data/uploads
```

## Production

Production deployment is documented here:

```text
docs/production-deploy.md
```

Production keeps code inside the Docker image, while SQLite data, uploaded signatures, accounts, and secrets stay on the server host.
