# Voxel Destruction

Voxel Wreckers is a pass-and-play 3D demolition game. Players spend their score
on mortars, airstrikes, and bulldozers to flatten voxel buildings over a series
of rounds.

## Environments

| Environment | Checkout | Branch | URL |
|---|---|---|---|
| Dev | `/home/justin/projects/voxel-destruction` | `dev` | <https://dev-destruction.fireorbooty.com> |
| Prod/UAT | `/home/justin/run/voxel-destruction-prod` | `main` | <https://destruction.fireorbooty.com> |

Everything builds, runs, and validates in Docker. Dev and Prod are isolated by
separate compose project and container names while sharing the host-level `edge`
network used by the Cloudflare tunnel.

## Operations

```bash
./setup.sh
docker compose run --rm --no-deps test
./rebuild.sh
./promote.sh --dry-run
./promote.sh --confirm  # requires explicit human production approval
```

The validation command checks required assets and parses every JavaScript module
inside a Node container. `rebuild.sh` runs it before rebuilding Nginx.

## Automated GitHub Watcher

An external watcher polls this repository's GitHub Issues. New issues begin at
`0_intake`, move through questions/design/development, and finish at
`4_dev_done`. Humans can comment `/design`, `/answered`, `/dev`, `/done`,
`/block`, `/review`, or `/reset-intake` to control the flow.

After `/dev` approval, the watcher works directly in the clean root checkout on
`dev`, validates in Docker, and commits as `fix: implement issue #N [agent]`.
Pull `origin/dev` to receive those commits. Promotion to `main` and Prod remains
human-gated through `promote.sh`.

## Runtime notes

The static app is served over HTTP on internal port 80. Cloudflare terminates
public HTTPS. The game currently loads Three.js, Google Fonts, React, ReactDOM,
and Babel from public CDNs, so a browser needs internet access to boot it fully.
