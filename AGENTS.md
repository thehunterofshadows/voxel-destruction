# Voxel Destruction Agent Guide

The centralized GitHub watcher operates directly in this repository's root
checkout on `dev`. Keep this checkout clean and pull `origin/dev` before manual
work so watcher-created commits are not missed.

## Environment topology

- Dev: `/home/justin/projects/voxel-destruction` on `dev`, available at
  `https://dev-destruction.fireorbooty.com`.
- Prod/UAT: `/home/justin/run/voxel-destruction-prod` on `main`, available at
  `https://destruction.fireorbooty.com`.
- All build, run, and validation work happens in Docker. Do not require
  host-installed Node or web-server dependencies.
- Dev and Prod use separate compose projects and containers. Both attach their
  HTTP-only web service to the shared external `edge` network.

## Commands

```bash
./setup.sh
docker compose run --rm --no-deps test
./rebuild.sh
./promote.sh --dry-run
./promote.sh --confirm  # only after explicit human production approval
```

The watcher validation command is exactly:

```bash
docker compose run --rm --no-deps test
```

## Required dev workflow

After every code, asset, or documentation change:

1. Run the watcher validation command:

   ```bash
   docker compose run --rm --no-deps test
   ```

2. Run:

   ```bash
   ./rebuild.sh
   ```

3. Verify the updated files are being served at
   `https://dev-destruction.fireorbooty.com`.

Do not report a change as complete until validation, rebuild, and dev-site
verification have succeeded.

## Project constraints

- The game is a static browser app. `index.html` boots the custom DC component,
  and the top-level JavaScript files are native ES modules.
- Keep relative asset imports working from the site root.
- Three.js, Google Fonts, React, ReactDOM, and Babel are loaded from public CDNs;
  browser sessions need internet access for a complete game boot.
- Do not add a project-local Cloudflare tunnel or token. The host's shared tunnel
  terminates TLS and reaches `voxel-destruction-*-web:80` over `edge`.
- Never commit `.env` or runtime directories.

## Automated GitHub Watcher

This repository's Issues are polled by an external watcher. Opening an issue
automatically starts intake and design. The watcher owns workflow labels
`0_intake` -> `1_questions` -> `2_design` -> `3_development` -> `4_dev_done`, plus
`human_review`, `blocked`, `dev_active`, and `z_quota_reached`.

Humans control the flow with `/design`, `/answered`, `/dev`, `/done`, `/block`,
`/review`, and `/reset-intake`. Approved work is implemented and committed
directly to `dev` as `fix: implement issue #N [agent]`; humans should pull `dev`
to synchronize. Promotion to `main` and Prod is always human-gated through
`./promote.sh`.
