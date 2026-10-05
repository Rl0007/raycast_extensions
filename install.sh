#!/bin/bash
# Installs every Raycast extension in this repo into Raycast on this Mac.
# Re-run after `git pull` to update them.
set -euo pipefail
cd "$(dirname "$0")"

command -v node >/dev/null || { echo "Node.js 22 or later is required: https://nodejs.org" >&2; exit 1; }
[ -d /Applications/Raycast.app ] || { echo "Raycast is not installed: https://www.raycast.com" >&2; exit 1; }
# `ray develop` hands the build to the running Raycast app.
open -g -a Raycast

for extension in */; do
	extension="${extension%/}"
	[ -f "$extension/package.json" ] || continue
	echo "== $extension"
	(cd "$extension" && npm ci --no-audit --no-fund --loglevel=error)

	log="$(mktemp)"
	(cd "$extension" && exec ./node_modules/.bin/ray develop --non-interactive >"$log" 2>&1) &
	develop_pid=$!
	# Raycast keeps a development extension after `ray develop` stops, so stop it once it has loaded.
	for _ in $(seq 1 120); do
		grep -q "built extension successfully" "$log" && break
		kill -0 "$develop_pid" 2>/dev/null || break
		sleep 1
	done
	if ! grep -q "built extension successfully" "$log"; then
		cat "$log" >&2
		kill -INT "$develop_pid" 2>/dev/null || true
		echo "$extension failed to load into Raycast" >&2
		exit 1
	fi
	kill -INT "$develop_pid" 2>/dev/null || true
	wait "$develop_pid" 2>/dev/null || true
	rm -f "$log"
	echo "   loaded into Raycast"
done

command -v frappectl >/dev/null || [ -x "$HOME/.local/bin/frappectl" ] ||
	echo "Note: frappectl is not installed. Run: uv tool install frappectl"
[ -x "$HOME/bin/devboxctl" ] || echo "Note: the Devbox extension needs a devboxctl script at ~/bin/devboxctl"
