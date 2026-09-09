# Omarchy Network

An enhanced **Wi-Fi / network panel** for the [Omarchy](https://omarchy.org/) bar: heat-coloured ping, a 20-minute download / upload / ping / packet-loss graph with peak callouts, always-available band pinning, one-click MAC obfuscation, NextDNS, and per-network band · signal · channel — cloned from stock `omarchy.network` without touching `/usr/share/omarchy`.

> **⚡ Built for Omarchy:** drop-in bar widget (`austraz.network`). Keep stock `omarchy.network` disabled so you only get one Wi-Fi chip.

```
Bar icon  →  panel  →  detail · 20-min graph · band pins · MAC · DNS · Wi-Fi list
```

Forked from Omarchy’s built-in network panel; extra features and ROI polish by [austrasien](https://github.com/austrasien).

---

### ☕ Support the Project
If this saves you from opening a terminal to find out which band you are on, whether the ping spike was you, and what your MAC just told the café router, a tip is always appreciated.

[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=for-the-badge&logo=paypal)](https://paypal.me/austraz)

---

### 💬 Feedback & Community
Got a question, found a bug, or have a suggestion? Open an [**issue**](https://github.com/austrasien/omarchy-network/issues).

---

## 🚀 Overview

Stock Omarchy shows SSID, signal, ping, rates and DNS as **instant numbers**: fine when the link is fine, useless the moment it is not — a number that was bad two minutes ago looks exactly like one that has been bad all afternoon.

This plugin keeps that hero UI and adds the three things you actually want when the link misbehaves:

- **History** — 20 minutes of download, upload, ping and packet loss on one graph, sampled at a fixed 10 s cadence whether the panel is open or closed.
- **Provenance** — the interface MAC, checked against the adapter’s burned-in address, and one click to associate with a random one.
- **Control** — pin 2.4 / 5 GHz even when the AP does not advertise both, point DNS at NextDNS, rescan on demand.

**Why bother?**

| | Stock `omarchy.network` ❌ | This plugin ✅ |
| :--- | :--- | :--- |
| **History** | Instant numbers only | 20-min graph: ↓ ↑ ping ✕loss, 10 s cadence |
| **Peaks** | — | 5 highest spikes labelled in place, de-duplicated |
| **Hide a series** | — | Click the legend; axis and peak labels recompute |
| **Ping** | Plain text | Heat-coloured green → yellow → orange, text and curve |
| **Max values** | — | `max( ↓ 42 MB/s  ↑ 3 MB/s  ● 240 ms )` in the legend |
| **Wi-Fi band** | Pills only when the AP advertises both, plus an `AUTOMATIC` switch | One row, always there: `2.4 GHz / Auto (5ghz) / 5 GHz` |
| **MAC** | — | Shown, and obfuscated on demand — click again to restore |
| **DNS** | DHCP / Cloudflare / **Google** / Custom | DHCP / Cloudflare / **NextDNS** / Custom |
| **Scanned networks** | SSID + signal icon | `known · 5 GHz · -48 dBm · ch 44` per row |
| **Rescan** | Whenever the panel felt like it | Button + `R` |
| **Stale NetworkManager** | `NOT CONNECTED` while you are online | Default route settles the argument |

> **Note:** nothing is persisted to disk. Graph history is in-memory, so `omarchy restart shell` starts the 20-minute window over. Band pins, MAC and DNS are not plugin state at all — they are written to your NetworkManager connection profile and survive independently of the shell.

## ✨ Key Features

### 🌡 Ping coloured by performance
- Both the **live value** in the detail grid and the **curve** in the graph are coloured by latency, per point: green under 50 ms, yellow under 120 ms, orange above.
- The colour is a property of the *value*, not of the moment: a 400 ms spike stays orange as it scrolls left, and the `max(● …)` legend entry is coloured by the **peak**, not by the ping happening right now.
- Packet loss keeps its own row, and its own ✕ dots in the graph on a fixed 0–100 % axis.

### 📈 20-minute graph, with the peaks named
- Four series: **download** (fuchsia, filled), **upload** (blue), **ping** (heat-coloured), **packet loss** (✕ dots).
- **Fixed 10 s cadence, panel open or closed.** The shape of the graph does not depend on whether you were looking at it — open the panel after twenty minutes away and the twenty minutes are there.
- 120 points over 20 minutes; download and upload share one rate axis so the two are directly comparable, ping and loss get their own.
- The **5 visually highest peaks** are labelled in place, above the spike they belong to, with de-duplication so two labels never name the same event.

### 🎛 Legend as switches
- Click **↓ / ↑ / ● / ✕ loss** to hide a series, click again to bring it back. Hidden entries dim rather than disappear, so the way back is where the way out was.
- Hiding rescales what is left: drop a 40 MB/s download and the upload curve stops being a flat line at the bottom of the plot.
- Peak labels are recomputed from the **visible** series only, so the five callouts are always the five you can actually see.
- Maxima are factorised like a function call — `max( ↓ ↑ ● )` — because the word three times did not fit, and loss sits outside it: a 0–100 % axis has no maximum worth reading.

### 📶 Band selector
- One row of pills: **`2.4 GHz` / `Auto (5ghz)` / `5 GHz`** (plus `6 GHz` when the radio offers it).
- **Auto names the band it resolved to**, so a single row tells you both the choice and the reality.
- Under a pin the pinned band is filled; under Auto nothing else lights up, so you never see two answers to one question.
- Bands the SSID does not answer on are dimmed with a tooltip that says so — pinning one would drop the link with nothing to reassociate to.
- A change is shown immediately and put back if the reconnect fails.

### 🕵 MAC address, shown and obfuscated
- The row shows the **current interface MAC**, compared against the adapter’s permanent address (`ethtool -P`).
- **Real MAC → white. Obfuscated → green**, and the label itself changes to `MAC (obfuscated)`: the colour is for people who know the code, the words are for everyone else.
- **Randomise** associates with a fresh locally-administered unicast MAC; **Restore** puts the hardware one back. Same button, toggling.
- Everything the system does afterwards — DHCP, DNS, the AP’s ARP table — uses the address on the interface, so the obfuscation is real and not cosmetic.
- Only the **active** profile is ever obfuscated: any MAC change also sweeps every other saved Wi-Fi profile back to hardware, so a random address cannot lie in wait on a network you rejoin next week.
- Safe by construction: `flock` against concurrent changes, `nmcli --wait 30` instead of the 90 s default, and an automatic revert-and-reconnect if the radio cannot come back with the new address.

### 📡 Detail for every network in range
- Each scanned row reads `status · band · signal · channel` — e.g. `known · 5 GHz · -48 dBm · ch 44`.
- Signal in **dBm** rather than four bars: -48 and -78 are both “three bars” and are not the same network.
- Dual-band SSIDs list both bands and both channels, so you can see the AP you are actually on.

### 🔄 Rescan on demand
- Button in the Wi-Fi list header, or press **`R`** with the panel open (`W` toggles the radio).
- The list itself reads the cache (`--rescan no`) and only the button forces a real scan, so opening the panel never blocks on the radio.

### 🩹 Survives a confused NetworkManager
- Run a monitor-mode tool (Airgorah, `airodump-ng`) and NetworkManager can be left believing you are offline while you are plainly not.
- The panel cross-checks with the **default route** via `omarchy-network-status`, so it stops claiming `NOT CONNECTED` at a machine that is streaming video.

## 🛠 Installation (Omarchy)

```sh
omarchy plugin add https://github.com/austrasien/omarchy-network.git --enable
omarchy plugin disable omarchy.network
omarchy restart shell
```

Already running a local `austraz.network` clone? Point it at GitHub:

```sh
cd ~/.config/omarchy/plugins/austraz.network
git init -b main   # if needed
git remote add origin https://github.com/austrasien/omarchy-network.git
git fetch origin && git reset --hard origin/main
omarchy restart shell
```

### Update / remove

```sh
omarchy plugin update austraz.network
omarchy plugin remove austraz.network
# restore stock if you want:
# omarchy plugin enable omarchy.network
```

### Requirements
- Omarchy Quattro shell (`omarchy-shell` / Quickshell)
- NetworkManager (`nmcli`) — band pins, MAC, connect / disconnect
- `ethtool` — reads the permanent hardware MAC (`pacman -S ethtool`); without it the MAC row hides rather than guesses
- Stock Omarchy helpers already on your box: `omarchy-network-status`, `omarchy-network-band`, `omarchy-network-qr`, `omarchy-network-speedtest`, `omarchy-network-password`, `omarchy-dns`
- Optional: `omarchy-nextdns` on `PATH` for the NextDNS pill

No sudo for the plugin itself — `nmcli` handles privileges through polkit, as it does on the command line.

## ⚙️ Configuration

There is nothing to configure in `shell.json`: every control is in the panel, and each one writes to the system rather than to plugin state.

| What you click | Where it goes | Persists across |
|---|---|---|
| Band pill | `802-11-wireless.band` on the active profile (via `omarchy-network-band`) | reboot |
| Randomise / Restore | `802-11-wireless.cloned-mac-address` on the active profile | reboot |
| DNS pill | `omarchy-dns <provider>`, or `omarchy-nextdns` for NextDNS | reboot |
| Legend toggles, panel state | in-memory only | nothing — reset by `omarchy restart shell` |
| Graph history | in-memory only | nothing |

**NextDNS** is optional. The pill needs `omarchy-nextdns` on `PATH`; install it and the pill configures and reports your own profile, skip it and the DNS row simply reports DHCP. No profile ID is baked into this repo.

The **MAC helper ships with the plugin** (`bin/omarchy-network-mac`) and is addressed by resolved path, so it works regardless of the `PATH` the shell was started with. It is a normal CLI too:

```sh
~/.config/omarchy/plugins/austraz.network/bin/omarchy-network-mac            # status: current, permanent, virtual?
~/.config/omarchy/plugins/austraz.network/bin/omarchy-network-mac random     # random locally-administered MAC
~/.config/omarchy/plugins/austraz.network/bin/omarchy-network-mac permanent  # back to hardware, everywhere
```

Want it on `PATH` like the stock helpers? Symlink it into `~/.config/omarchy/bin` (already on `PATH` on Omarchy):

```sh
ln -s ~/.config/omarchy/plugins/austraz.network/bin/omarchy-network-mac ~/.config/omarchy/bin/omarchy-network-mac
```

## 🔌 IPC

The panel owns the `omarchy.network` IPC target, so existing keybinds keep working:

```sh
omarchy-shell omarchy.network open|close|toggle
```

## ⚖️ License

Licensed under the **MIT License**. Stock Omarchy panel patterns remain © their upstream authors; this clone’s extras are MIT.

---
*Developed so a bad Wi-Fi afternoon leaves evidence instead of a shrug.*
