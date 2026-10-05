<div align="center" markdown="1">

<p>
	<img src="raycast_frappectl/assets/extension-icon.png" alt="Frappectl extension icon" width="80" />
	<img src="raycast_devboxctl/assets/extension-icon.png" alt="Devbox extension icon" width="80" />
</p>
<h1>Raycast extensions for Frappe developers</h1>

**Manage Frappe sites and dev boxes from Raycast**

</div>

Raycast extensions that put everyday Frappe chores one keystroke away: picking a site profile, logging in to a new site, rotating API keys, and getting into a dev box. Frappectl and Devbox are thin front ends over command-line tools, so nothing here stores credentials of its own. Recent Screenshots is a small extra for sharing what is on your screen.

### Extensions

- **[Frappectl](raycast_frappectl)**: manage the site profiles of [frappectl](https://github.com/frappe/frappectl), the command-line client for Frappe sites
- **[Devbox](raycast_devboxctl)**: list, attach to and provision dev boxes through a `devboxctl` script
- **[Recent Screenshots](raycast_screenshots)**: pick recent screenshots and screen recordings, copy or paste them, or paste their paths into a terminal

### Screenshots

Shown with sample data.

**List Profiles**

<picture>
	<source media="(prefers-color-scheme: dark)" srcset=".github/screenshots/list-profiles-dark.webp" />
	<img src=".github/screenshots/list-profiles-light.webp" alt="List Profiles command" width="720" />
</picture>

**Add Site**

<picture>
	<source media="(prefers-color-scheme: dark)" srcset=".github/screenshots/add-site-dark.webp" />
	<img src=".github/screenshots/add-site-light.webp" alt="Add Site command" width="720" />
</picture>

**Refresh API Keys**

<picture>
	<source media="(prefers-color-scheme: dark)" srcset=".github/screenshots/refresh-api-keys-dark.webp" />
	<img src=".github/screenshots/refresh-api-keys-light.webp" alt="Refresh API Keys command" width="720" />
</picture>

**Dev Boxes**

<picture>
	<source media="(prefers-color-scheme: dark)" srcset=".github/screenshots/dev-boxes-dark.webp" />
	<img src=".github/screenshots/dev-boxes-light.webp" alt="Dev Boxes command" width="720" />
</picture>

**Provision Dev Box**

<picture>
	<source media="(prefers-color-scheme: dark)" srcset=".github/screenshots/provision-dev-box-dark.webp" />
	<img src=".github/screenshots/provision-dev-box-light.webp" alt="Provision Dev Box command" width="720" />
</picture>

### Features

Frappectl:

- **List Profiles**: search every stored profile, see its site, auth type and read-only flag, and open the site or copy its URL
- **Add Site**: fill in a form, then finish the login in your terminal (OAuth in the browser, or API key and secret)
- **Refresh API Keys**: re-enter the key and secret for a profile, keeping its name, description and read-only flag
- Make a profile writable or read-only, and delete a profile with its stored credentials

Devbox:

- **Dev Boxes**: see your boxes with status, template and memory use, and attach to one in a terminal
- Open a box's site, web editor or web terminal, copy its slug or attach command, and give it a nickname
- Start, stop and delete a box, each behind a confirmation
- **Provision Dev Box**: pick a profile and branch, then watch the provisioning run in your terminal
- **Servers**: see RAM, disk, CPU load, uptime and dev box count for each server, read over SSH

Recent Screenshots:

- **Recent Screenshots**: browse your latest screenshots and screen recordings in a grid, newest first
- Copy or paste a capture, or select several and copy them in one go
- Paste Path or Copy Path to drop a capture's file path into a terminal
- Set how many captures to show and which folder to read, which defaults to where macOS saves screenshots

### How it works

Logging in always happens in a real terminal. frappectl refuses to read credentials from a pipe, so they never end up in shell history or logs, and these extensions keep it that way. Everything else (listing, toggling read-only, deleting) runs in the background.

### Installation

You need macOS, [Raycast](https://www.raycast.com), Node.js 22 or later, and iTerm or Terminal.

1. Install frappectl: `uv tool install frappectl`
2. For Devbox, put your `devboxctl` script at `~/bin/devboxctl` and add a frappectl profile named `devbox` for the site that tracks your boxes.
3. Clone this repo and load every extension into Raycast:

```bash
git clone https://github.com/Rl0007/raycast_extensions.git ~/raycast_extensions
~/raycast_extensions/install.sh
```

Run the same two lines on each Mac to get the same extensions everywhere. To update, run `git -C ~/raycast_extensions pull && ~/raycast_extensions/install.sh`. Profiles and API keys stay on each Mac. Pick iTerm or Terminal in each extension's preferences.

### Development

```bash
cd raycast_frappectl
npm run dev
npm run lint
```

`npm run dev` reloads the extension in Raycast on every save.

### Support

Found a bug or have a question? [Open an issue](https://github.com/Rl0007/raycast_extensions/issues).

#### License

MIT
