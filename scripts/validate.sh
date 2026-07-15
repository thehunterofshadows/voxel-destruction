#!/bin/sh

set -eu

cd /app

required_files="index.html support.js main.js physics.js sfx.js weapons.js world.js hud.js nginx.conf"
for file in $required_files; do
  if [ ! -s "$file" ]; then
    echo "Missing required asset: $file" >&2
    exit 1
  fi
done

for file in ./*.js; do
  node --check "$file"
done

for asset in support.js main.js; do
  if ! grep -Fq "./$asset" index.html; then
    echo "index.html does not reference $asset" >&2
    exit 1
  fi
done

echo "Voxel Destruction static validation passed."
