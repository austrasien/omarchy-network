function parseNetworkStatus(raw) {
  var parts = String(raw || "disconnected\t\t\t").replace(/\r?\n+$/, "").split("\t")
  return {
    kind: parts[0] || "disconnected",
    label: parts[1] || "",
    signalStrength: parts[2] ? parseInt(parts[2], 10) : -1,
    frequency: parts[3] || ""
  }
}

function wifiIconFor(strength) {
  var icons = ["󰤯", "󰤟", "󰤢", "󰤥", "󰤨"]
  var index = Math.max(0, Math.min(4, Math.ceil(strength / 20) - 1))
  return icons[index]
}

function connectionIcon(kind, signalStrength) {
  if (kind === "wifi") return wifiIconFor(signalStrength)
  if (kind === "ethernet") return "󰈀"
  return "󰤮"
}

function formatHeaderSpeed(mbps) {
  var v = parseInt(mbps, 10)
  if (!v || v < 0) return ""
  if (v >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + "gbit"
  return v + "mbit"
}

function formatHeaderFreq(mhz) {
  var v = parseFloat(mhz)
  if (!v) return ""

  if (v >= 2400 && v < 2500) return "2.4ghz"
  if (v >= 4900 && v < 5925) return "5ghz"
  if (v >= 5925 && v < 7125) return "6ghz"
  if (v >= 57000 && v < 71000) return "60ghz"

  var ghz = v / 1000
  return ghz.toFixed(ghz % 1 === 0 ? 0 : 1) + "ghz"
}

function bandTokenFromFreq(mhz) {
  var v = parseFloat(mhz)
  if (!v) return ""

  if (v >= 2400 && v < 2500) return "2.4"
  if (v >= 4900 && v < 5925) return "5"
  if (v >= 5925 && v < 7125) return "6"
  if (v >= 57000 && v < 71000) return "60"
  return ""
}

function bandSortKey(band) {
  var n = parseFloat(band)
  return isFinite(n) ? n : 999
}

function uniqueSortedBands(bands) {
  var seen = {}
  var list = []
  var source = Array.isArray(bands) ? bands : []

  for (var i = 0; i < source.length; i++) {
    var band = source[i]
    if (!band || seen[band]) continue
    seen[band] = true
    list.push(band)
  }

  list.sort(function(a, b) { return bandSortKey(a) - bandSortKey(b) })
  return list
}

// "5ghz" for one band, "2.4 / 5ghz" when the SSID answers on several.
function formatRowBands(bands) {
  var list = uniqueSortedBands(bands)
  if (list.length === 0) return ""
  if (list.length === 1) return bandLabel(list[0])

  var labels = []
  for (var i = 0; i < list.length - 1; i++) labels.push(list[i])
  labels.push(bandLabel(list[list.length - 1]))
  return labels.join(" / ")
}

// nmcli -g FREQ,SIGNAL,CHAN,SSID. SSID is last so a name containing ':' is
// reassembled verbatim — same rule as omarchy-network-band.
function parseWifiScan(raw) {
  var bandsBySsid = {}
  var signals = {}
  var channels = {}
  var lines = String(raw || "").split("\n")

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    if (!line) continue

    var parsed = parseWifiScanLine(line)
    if (!parsed) continue

    var ssid = parsed.ssid
    var band = bandTokenFromFreq(parsed.freq)
    if (band) {
      if (!bandsBySsid[ssid]) bandsBySsid[ssid] = []
      bandsBySsid[ssid].push(band)
    }

    if (isFinite(parsed.signal) && parsed.signal > (signals[ssid] || 0)) signals[ssid] = parsed.signal

    var chan = parsed.channel || channelFromFreq(parsed.freq)
    if (chan > 0) {
      if (!channels[ssid]) channels[ssid] = []
      channels[ssid].push(chan)
    }
  }

  var bands = {}
  var chans = {}
  for (var ssid in bandsBySsid) {
    if (!Object.prototype.hasOwnProperty.call(bandsBySsid, ssid)) continue
    bands[ssid] = uniqueSortedBands(bandsBySsid[ssid])
  }
  for (var name in channels) {
    if (!Object.prototype.hasOwnProperty.call(channels, name)) continue
    chans[name] = uniqueSortedNumbers(channels[name])
  }

  return { bands: bands, signals: signals, channels: chans }
}

function parseWifiScanLine(line) {
  var first = line.indexOf(":")
  if (first === -1) return null

  var rest = line.substring(first + 1)
  var second = rest.indexOf(":")
  var freq = line.substring(0, first)

  if (second === -1) {
    return { freq: freq, signal: 0, channel: 0, ssid: rest }
  }

  var afterSignal = rest.substring(second + 1)
  var third = afterSignal.indexOf(":")
  var signal = parseInt(rest.substring(0, second), 10)

  if (third === -1) {
    return { freq: freq, signal: signal, channel: 0, ssid: afterSignal }
  }

  return {
    freq: freq,
    signal: signal,
    channel: parseInt(afterSignal.substring(0, third), 10) || 0,
    ssid: afterSignal.substring(third + 1)
  }
}

function channelFromFreq(mhz) {
  var v = parseFloat(mhz)
  if (!v) return 0
  if (v === 2484) return 14
  if (v >= 2412 && v < 2484) return Math.round((v - 2407) / 5)
  if (v >= 5000 && v < 5900) return Math.round((v - 5000) / 5)
  if (v >= 5955 && v < 7125) return Math.round((v - 5950) / 5)
  return 0
}

function uniqueSortedNumbers(values) {
  var seen = {}
  var list = []
  var source = Array.isArray(values) ? values : []

  for (var i = 0; i < source.length; i++) {
    var n = parseInt(source[i], 10)
    if (!isFinite(n) || n <= 0 || seen[n]) continue
    seen[n] = true
    list.push(n)
  }

  list.sort(function(a, b) { return a - b })
  return list
}

function parseWifiScanBands(raw) {
  return parseWifiScan(raw).bands
}

function bandsForSsid(bandsBySsid, ssid) {
  var map = bandsBySsid || {}
  var list = map[ssid || ""]
  return uniqueSortedBands(list)
}

function withLiveBand(bandsBySsid, ssid, freq, liveBand) {
  var next = {}
  var map = bandsBySsid || {}
  for (var key in map) {
    if (!Object.prototype.hasOwnProperty.call(map, key)) continue
    next[key] = uniqueSortedBands(map[key])
  }
  if (!ssid) return next
  var token = bandTokenFromFreq(freq) || String(liveBand || "")
  if (!token || token === "auto") return next
  var list = next[ssid] ? next[ssid].slice() : []
  list.push(token)
  next[ssid] = uniqueSortedBands(list)
  return next
}

// Ethernet keeps negotiated link speed beside the hero name. Wi-Fi shows the
// live radio band here so a single-band AP still names itself; the dedicated
// band selector covers dual-band networks once it is on screen.
function headerDetail(info, liveBand, bandSelectorVisible) {
  var value = info || {}
  if (value.type === "ethernet") return formatHeaderSpeed(value.speed || "")
  if (value.type !== "wifi" || bandSelectorVisible) return ""
  return formatHeaderFreq(value.freq || "") || bandLabel(liveBand || "")
}

function bandLabel(band) {
  if (band === "auto") return "Auto"
  if (!band) return ""
  return band + "ghz"
}

// The Auto pill names the band it resolved to -- "Auto (5ghz)" -- so one row
// states both the choice and the reality. Only while Auto is in force: under a
// pin the live band *is* the pinned one, and repeating it here would suggest
// Auto had picked it.
function bandPillLabel(band, selected, current) {
  if (band !== "auto") return bandLabel(band)
  if (selected !== "auto") return "Auto"

  var label = bandLabel(current)
  return label === "" ? "Auto" : "Auto (" + label + ")"
}

function bandTooltip(band) {
  if (band === "auto") return "Let Wi-Fi pick the band"
  if (!band) return ""
  return "Stay on " + bandLabel(band)
}

function parseBandStatus(raw) {
  var next = parseKeyValue(raw)
  var tokens = String(next.available || "").split(" ")
  var available = []

  for (var i = 0; i < tokens.length; i++) {
    if (tokens[i] !== "") available.push(tokens[i])
  }

  return {
    band: next.band || "",
    selected: next.selected || "auto",
    available: available
  }
}

function decodeIwSsid(value) {
  var raw = String(value || "")

  try {
    var encoded = ""

    for (var i = 0; i < raw.length; i++) {
      if (raw[i] === "\\" && raw[i + 1] === "x" && /^[0-9a-f]{2}$/i.test(raw.substring(i + 2, i + 4))) {
        var hex = raw.substring(i + 2, i + 4)
        var byte = parseInt(hex, 16)
        encoded += byte < 32 || byte === 127 ? encodeURIComponent(raw.substring(i, i + 4)) : "%" + hex
        i += 3
      } else {
        encoded += encodeURIComponent(raw[i])
      }
    }

    return decodeURIComponent(encoded)
  } catch (error) {
    return raw
  }
}

function parseKeyValue(raw) {
  var next = {}
  var lines = String(raw || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    if (!line) continue
    var idx = line.indexOf("\t")
    if (idx === -1) continue
    var key = line.substring(0, idx)
    var value = line.substring(idx + 1)
    next[key] = key === "ssid" ? decodeIwSsid(value) : value.trim()
  }
  return next
}

function throughputState(previous, next, now) {
  var prev = previous || {}
  var sample = next || {}
  var iface = sample.iface || ""
  var rx = parseFloat(sample.rx_bytes || "0")
  var tx = parseFloat(sample.tx_bytes || "0")
  var previousTime = Number(prev.prevSampleTime || 0)

  if (iface !== (prev.prevIface || "") || previousTime === 0) {
    return {
      prevIface: iface,
      prevRxBytes: rx,
      prevTxBytes: tx,
      prevSampleTime: now,
      downloadRate: 0,
      uploadRate: 0
    }
  }

  var downloadRate = Number(prev.downloadRate || 0)
  var uploadRate = Number(prev.uploadRate || 0)
  var dt = now - previousTime
  if (dt > 0) {
    downloadRate = Math.max(0, (rx - Number(prev.prevRxBytes || 0)) / dt)
    uploadRate = Math.max(0, (tx - Number(prev.prevTxBytes || 0)) / dt)
  }

  return {
    prevIface: iface,
    prevRxBytes: rx,
    prevTxBytes: tx,
    prevSampleTime: now,
    downloadRate: downloadRate,
    uploadRate: uploadRate
  }
}

function pingSampleValue(raw) {
  var value = parseFloat(raw)
  if (!isFinite(value) || value < 0) return null
  return value
}

function appendPingSample(samples, raw, limit) {
  var values = Array.isArray(samples) ? samples.slice() : []

  values.push(pingSampleValue(raw))
  while (values.length > limit) values.shift()

  return values
}

function averagePingLatency(samples, limit) {
  var values = Array.isArray(samples) ? samples : []
  var sampleLimit = Math.max(1, parseInt(limit, 10) || values.length || 1)
  var total = 0
  var count = 0

  for (var i = Math.max(0, values.length - sampleLimit); i < values.length; i++) {
    var value = values[i]
    if (typeof value !== "number" || !isFinite(value) || value < 0) continue
    total += value
    count++
  }

  return count > 0 ? total / count : -1
}

function pingPacketLossPercent(samples) {
  var values = Array.isArray(samples) ? samples : []
  if (values.length === 0) return 0

  var lost = 0
  for (var i = 0; i < values.length; i++) {
    if (values[i] === null) lost++
  }

  return Math.round((lost / values.length) * 100)
}

function formatPacketLoss(percent, hasSamples) {
  if (hasSamples === false) return "--"

  var value = parseInt(percent, 10)
  if (!value || value < 0) return "0%"
  return value + "%"
}

function pingLatencyState(previous, next, limit, averageLimit) {
  var prev = previous || {}
  var sample = next || {}
  var iface = sample.iface || ""
  var window = Math.max(1, parseInt(limit, 10) || 5)
  var averageWindow = Math.max(1, parseInt(averageLimit, 10) || window)
  var reset = iface === "" || iface !== (prev.pingIface || "")
  var routerSamples = reset ? [] : prev.routerPingSamples
  var internetSamples = reset ? [] : prev.internetPingSamples

  routerSamples = sample.router_ping_ms === undefined ? [] : appendPingSample(routerSamples, sample.router_ping_ms, window)
  internetSamples = sample.internet_ping_ms === undefined ? [] : appendPingSample(internetSamples, sample.internet_ping_ms, window)

  return {
    pingIface: iface,
    routerPingSamples: routerSamples,
    internetPingSamples: internetSamples,
    routerPingLatency: averagePingLatency(routerSamples, averageWindow),
    internetPingLatency: averagePingLatency(internetSamples, averageWindow),
    internetPingPacketLoss: pingPacketLossPercent(internetSamples)
  }
}

function formatBytes(bytes) {
  var n = Number(bytes)
  if (!isFinite(n) || n < 0) n = 0
  if (n < 1024) return Math.round(n) + " B"
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB"
  if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " MB"
  return (n / (1024 * 1024 * 1024)).toFixed(2) + " GB"
}

function formatRate(bytesPerSec) {
  return formatBytes(bytesPerSec) + "/s"
}

function niceCeil(value) {
  var v = Number(value)
  if (!isFinite(v) || v <= 0) return 1
  var exp = Math.pow(10, Math.floor(Math.log(v) / Math.LN10))
  var mantissa = v / exp
  var nice = mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 5 ? 5 : 10
  return nice * exp
}

function pingSampleOrNull(raw) {
  return pingSampleValue(raw)
}

// The graph must not change shape depending on whether the panel is open.
// updateDetails runs every 1.5s while open and every 10s while closed, so
// recording whatever rate that poll happened to compute made an open panel
// plot 1.5s bursts and a closed one plot 10s averages -- the same traffic at
// two different heights. This gates history on a fixed step and derives the
// rate from the byte counters across that whole step, so both paths produce
// the same number. Ping is likewise taken once per step, not maxed over the
// six probes an open panel fires in the interval.
function historyTick(previous, sample, nowMs, stepMs) {
  var prev = previous || {}
  var s = sample || {}
  var iface = s.iface || ""
  var rx = parseFloat(s.rx_bytes || "0")
  var tx = parseFloat(s.tx_bytes || "0")
  var step = Math.max(1000, Number(stepMs) || 10000)
  var now = Number(nowMs)
  if (!isFinite(now) || now <= 0) now = Date.now()
  if (!isFinite(rx) || rx < 0) rx = 0
  if (!isFinite(tx) || tx < 0) tx = 0

  var prevTime = Number(prev.time)
  var idle = { iface: iface, rx: rx, tx: tx, time: now, due: false, down: 0, up: 0, ping: null }

  // No usable baseline: adopt this sample as one and emit nothing.
  if (iface === "" || iface !== (prev.iface || "") || !(prevTime > 0)) return idle

  // A backwards clock jump would otherwise never satisfy the step again and
  // freeze the graph for good, so re-baseline instead of holding.
  var elapsed = now - prevTime
  if (elapsed < 0) return idle
  if (elapsed < step) {
    // Hold the baseline so the next due tick still spans a full step.
    return {
      iface: prev.iface,
      rx: prev.rx,
      tx: prev.tx,
      time: prevTime,
      due: false,
      down: 0,
      up: 0,
      ping: null
    }
  }

  var dt = elapsed / 1000
  return {
    iface: iface,
    rx: rx,
    tx: tx,
    time: now,
    due: true,
    down: Math.max(0, (rx - Number(prev.rx || 0)) / dt),
    up: Math.max(0, (tx - Number(prev.tx || 0)) / dt),
    ping: pingSampleValue(s.internet_ping_ms)
  }
}

// Ping keeps its own series at full probe cadence. Folding it into the 10s
// rate buckets threw away five probes out of six while the panel was open, and
// unlike a rate there is nothing to integrate: a rate derived from byte
// counters accounts for every byte in the step, whereas a dropped probe is a
// latency reading that no longer exists. The probes are already being made for
// the Ping row, so the finer series costs nothing but the array.
function lossSampleValue(percent) {
  var v = Number(percent)
  if (!isFinite(v) || v <= 0) return 0
  return Math.min(100, v)
}

function pushPingSample(history, nowMs, ping, loss, windowMs) {
  var points = Array.isArray(history) ? history.slice() : []
  var now = Number(nowMs)
  if (!isFinite(now) || now <= 0) now = Date.now()
  var window = Math.max(1000, Number(windowMs) || 1200000)

  // A timed-out probe is kept as null: the gap it opens in the curve is itself
  // worth seeing, and dropping it would silently close over the outage.
  // Loss rides the same series: it is derived from the same probe window, so it
  // shares the ping's cadence exactly.
  points.push({ t: now, ping: pingSampleValue(ping), loss: lossSampleValue(loss) })

  var cutoff = now - window
  while (points.length > 0 && points[0].t < cutoff) points.shift()
  return points
}

function pingExtent(points) {
  var list = Array.isArray(points) ? points : []
  var peak = 0

  for (var i = 0; i < list.length; i++) {
    var p = list[i]
    if (!p) continue
    var v = p.ping
    if (typeof v === "number" && isFinite(v) && v > peak) peak = v
  }

  return { peak: peak, axis: peak > 0 ? niceCeil(peak) : 0 }
}

function pushTrafficSample(history, nowMs, down, up, ping, windowMs, stepMs) {
  var points = Array.isArray(history) ? history.slice() : []
  var window = Math.max(1000, Number(windowMs) || 3600000)
  var step = Math.max(1000, Number(stepMs) || 10000)
  var now = Number(nowMs)
  if (!isFinite(now) || now <= 0) now = Date.now()

  var bucket = Math.floor(now / step) * step
  var downRate = Math.max(0, Number(down) || 0)
  var upRate = Math.max(0, Number(up) || 0)
  var pingMs = pingSampleOrNull(ping)

  var last = points.length > 0 ? points[points.length - 1] : null
  if (last && last.t === bucket) {
    var pingKeep = typeof last.ping === "number" && isFinite(last.ping) ? last.ping : null
    if (typeof pingMs === "number" && isFinite(pingMs)) {
      pingKeep = pingKeep === null ? pingMs : Math.max(pingKeep, pingMs)
    }
    points[points.length - 1] = {
      t: bucket,
      down: Math.max(Number(last.down) || 0, downRate),
      up: Math.max(Number(last.up) || 0, upRate),
      ping: pingKeep
    }
  } else {
    points.push({ t: bucket, down: downRate, up: upRate, ping: pingMs })
  }

  var cutoff = now - window
  while (points.length > 0 && points[0].t < cutoff) points.shift()
  return points
}

function trafficExtents(points) {
  var list = Array.isArray(points) ? points : []
  var down = 0
  var up = 0
  var ping = 0

  for (var i = 0; i < list.length; i++) {
    var p = list[i]
    if (!p) continue
    var d = Number(p.down)
    var u = Number(p.up)
    if (isFinite(d) && d > down) down = d
    if (isFinite(u) && u > up) up = u
    if (typeof p.ping === "number" && isFinite(p.ping) && p.ping >= 0 && p.ping > ping) ping = p.ping
  }

  // `down`/`up`/`ping` are axis bounds (rounded up so a lane's top is a round
  // number); `*Peak` are the values actually measured. A legend that reads
  // "max" must use the latter, or it contradicts the peak callouts. Each lane
  // scales on its own now, so download no longer flattens upload to a line.
  return {
    down: down > 0 ? niceCeil(down) : 0,
    up: up > 0 ? niceCeil(up) : 0,
    rate: down > 0 || up > 0 ? niceCeil(Math.max(down, up)) : 0,
    ping: ping > 0 ? niceCeil(ping) : 0,
    downPeak: down,
    upPeak: up,
    pingPeak: ping
  }
}

// Pin "now" to the right. Until a full hour exists, shrink the x-axis to the
// data we have (floor 2 min) so a few samples are not a hairline on 60 min.
function trafficTimeWindow(points, nowMs, windowMs) {
  var list = Array.isArray(points) ? points : []
  var now = Number(nowMs)
  if (!isFinite(now) || now <= 0) {
    now = list.length > 0 ? Number(list[list.length - 1].t) : 0
  }
  var window = Math.max(1000, Number(windowMs) || 3600000)
  if (!(now > 0)) return { t0: 0, t1: window, minutes: Math.round(window / 60000) }
  var t1 = now
  if (list.length === 0) return { t0: t1 - window, t1: t1, minutes: Math.round(window / 60000) }

  var first = Number(list[0].t)
  if (!isFinite(first)) return { t0: t1 - window, t1: t1, minutes: Math.round(window / 60000) }

  var elapsed = Math.max(0, t1 - first)
  var span = Math.min(window, Math.max(elapsed, 20000))
  return { t0: t1 - span, t1: t1, minutes: Math.max(1, Math.round(span / 60000)) }
}

function mapChartY(value, max, top, height) {
  var v = Number(value)
  var m = Number(max)
  if (!isFinite(v) || v < 0) v = 0
  if (!isFinite(m) || m <= 0) return top + height
  var t = v / m
  if (t > 1) t = 1
  return top + (1 - t) * height
}

function pingHeatColor(ms) {
  var v = Number(ms)
  if (!isFinite(v) || v < 0) return "#888888"
  if (v <= 50) return "#3dd68c"
  if (v <= 120) return "#e0c35a"
  return "#ff9a32"
}

function chartX(t, t0, t1, x, w) {
  return x + ((t - t0) / (t1 - t0)) * w
}

function strokeDashedSegment(ctx, x0, y0, x1, y1, dash, gap, phase) {
  var dx = x1 - x0
  var dy = y1 - y0
  var len = Math.sqrt(dx * dx + dy * dy)
  var period = dash + gap
  if (!isFinite(len) || len < 0.4 || !(period > 0)) return phase || 0

  var ux = dx / len
  var uy = dy / len
  var pos = 0
  var offset = ((phase || 0) % period + period) % period
  var guard = 0
  var maxIter = Math.ceil(len) + 8

  while (pos < len && guard++ < maxIter) {
    var inDash = offset < dash
    var remain = inDash ? dash - offset : period - offset
    if (!(remain > 0.05)) {
      offset = 0
      pos += 0.05
      continue
    }
    var next = Math.min(len, pos + remain)
    if (!(next > pos)) break
    if (inDash) {
      ctx.moveTo(x0 + ux * pos, y0 + uy * pos)
      ctx.lineTo(x0 + ux * next, y0 + uy * next)
    }
    offset = (offset + (next - pos)) % period
    pos = next
  }

  return offset
}

function strokeTrafficSeries(ctx, points, key, max, x, y, w, h, t0, t1, style) {
  if (!ctx || !Array.isArray(points) || points.length === 0 || t1 <= t0 || w <= 0 || h <= 0) return

  var opts = style || {}
  var heat = key === "ping"
  var dashed = !heat
  var solid = opts.color || (heat ? pingHeatColor(0) : ctx.strokeStyle)
  var dash = 5
  var gap = 4
  var phase = 0

  ctx.lineJoin = "round"
  ctx.lineCap = "round"

  var prev = null
  if (dashed) ctx.beginPath()
  for (var i = 0; i < points.length; i++) {
    var p = points[i]
    if (!p) continue
    var value = heat ? p.ping : p[key]
    if (typeof value !== "number" || !isFinite(value) || value < 0) {
      prev = null
      continue
    }

    var px = chartX(p.t, t0, t1, x, w)
    var py = mapChartY(value, max, y, h)

    if (!prev) {
      prev = { x: px, y: py, value: value }
      continue
    }

    if (heat) {
      ctx.strokeStyle = pingHeatColor(Math.max(prev.value, value))
      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(px, py)
      ctx.stroke()
    } else if (dashed) {
      phase = strokeDashedSegment(ctx, prev.x, prev.y, px, py, dash, gap, phase)
    } else {
      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(px, py)
      ctx.stroke()
    }
    prev = { x: px, y: py, value: value }
  }
  if (dashed) {
    ctx.strokeStyle = solid
    ctx.stroke()
  }
}

// `hasSamples` false means no probe has come back yet, which is different from
// a probe that timed out. The rows stay mounted through that gap and read "--"
// so the grid doesn't reflow a second after the panel opens.
function formatPingLatency(ms, hasSamples) {
  if (hasSamples === false) return "--"

  var value = parseFloat(ms)
  if (!isFinite(value) || value < 0) return "Timeout"
  return value.toFixed(value > 0 && value < 10 ? 1 : 0) + " ms"
}

function wifiSignalPercent(raw) {
  var v = Number(raw)
  if (!isFinite(v) || v <= 0) return 0
  if (v <= 1) return Math.round(v * 100)
  return Math.round(Math.min(100, v))
}

function percentToDbm(percent) {
  var p = wifiSignalPercent(percent)
  if (p <= 0) return 0
  return Math.round(p / 2 - 100)
}

// Inverse of percentToDbm, for the case where the only signal reading available
// is the one omarchy-network-status scrapes off the live interface.
function dbmToPercent(dbm) {
  var v = Number(dbm)
  if (!isFinite(v) || v >= 0) return 0
  return Math.max(0, Math.min(100, Math.round((v + 100) * 2)))
}

function formatRssi(dbm) {
  var v = Number(dbm)
  if (!isFinite(v) || v >= 0) return ""
  return Math.round(v) + " dBm"
}

function formatChannel(channels) {
  var list = uniqueSortedNumbers(channels)
  if (list.length === 0) return ""
  return "ch " + list.join(" / ")
}

function joinMeta(parts) {
  var out = []
  var source = Array.isArray(parts) ? parts : []
  for (var i = 0; i < source.length; i++) {
    if (source[i]) out.push(source[i])
  }
  return out.join(" · ")
}

function wifiRow(network, bandsBySsid, signalsBySsid, channelsBySsid, liveRssi) {
  if (!network) return null
  // Primitives only: rows become list-model data, so a WifiNetwork here puts a
  // live QObject wrapper in every delegate's var property. NetworkManager churn
  // (scans, AP removals) can destroy the object while a delegate is still
  // incubating, which segfaults quickshell in wrap_slowPath on the dangling
  // wrapper. Callers that need the object resolve it via networkForSsid().
  var ssid = network.name || ""
  var bands = bandsForSsid(bandsBySsid, ssid)
  var scanSignal = (signalsBySsid && signalsBySsid[ssid]) || 0
  var signal = Math.max(wifiSignalPercent(network.signalStrength), scanSignal)
  var dbm = percentToDbm(signal)
  var live = Number(liveRssi)
  if (network.connected && isFinite(live) && live < 0) dbm = Math.round(live)

  return {
    connected: !!network.connected,
    known: !!network.known,
    ssid: ssid,
    signal: signal,
    security: network.security,
    bands: bands,
    bandLabel: formatRowBands(bands),
    rssiLabel: formatRssi(dbm),
    channelLabel: formatChannel(channelsBySsid && channelsBySsid[ssid])
  }
}

function rowStatusLine(status, bandLabel, rssiLabel, channelLabel) {
  return joinMeta([status, bandLabel, rssiLabel, channelLabel])
}

function sortWifiRows(rows) {
  var nets = Array.isArray(rows) ? rows.slice() : []
  nets.sort(function(a, b) {
    if (a.connected !== b.connected) return a.connected ? -1 : 1
    if (a.known !== b.known) return a.known ? -1 : 1
    if (a.signal !== b.signal) return b.signal - a.signal
    return String(a.ssid || "").localeCompare(String(b.ssid || ""))
  })
  return nets
}

function wifiSectionTitle(wifiNetworks, index) {
  var networks = Array.isArray(wifiNetworks) ? wifiNetworks : []
  if (index < 0 || index >= networks.length) return ""

  var net = networks[index]
  if (!net) return ""

  if (net.known && index === 0) return "KNOWN NETWORKS"
  if (!net.known && (index === 0 || (networks[index - 1] && networks[index - 1].known))) return "OTHER NETWORKS"
  return ""
}

// OWE (Enhanced Open) encrypts traffic without authenticating the user, so it
// has no credentials to collect. The panel's lock is a credentials-required
// affordance, so OWE should neither show it nor open its attached prompt.
function requiresCredentials(security, openSecurity, oweSecurity) {
  // Only explicit passwordless types bypass the prompt. Unknown security
  // stays credentialed as the conservative fallback.
  return security !== openSecurity && security !== oweSecurity
}

function canForgetNetwork(network) {
  return !!(network && network.known && !network.connected)
}

// The password arrives on stdin and reaches nmcli through the scriptable
// `connection edit` editor -- argv is world-readable in /proc, so the secret
// must never be an argument (printf is a bash builtin, so no process spawns
// with it either).
var enterpriseConnectScript =
  "u=$(uuidgen); IFS= read -r pw;" +
  " nmcli connection add type wifi con-name \"$1\" ssid \"$1\" connection.uuid \"$u\"" +
  " wifi-sec.key-mgmt wpa-eap 802-1x.eap peap 802-1x.phase2-auth mschapv2" +
  " 802-1x.identity \"$2\" 802-1x.auth-timeout 8 >/dev/null" +
  " && printf 'set 802-1x.password %s\\nsave\\nquit\\n' \"$pw\" | nmcli connection edit uuid \"$u\" >/dev/null" +
  " && nmcli connection up uuid \"$u\"" +
  " || { nmcli connection delete uuid \"$u\" >/dev/null 2>&1; false; }"

function networkFailureReason(reason, needsCredentials, reasons) {
  var r = reasons || {}
  if (needsCredentials && reason === r.NoSecrets) return "Passphrase required"
  if (needsCredentials && reason === r.WifiAuthTimeout) return "Wrong password"
  if (reason === r.WifiNetworkLost) return "Network lost"
  if (reason === r.WifiClientDisconnected) return "Disconnected"
  if (reason === r.WifiClientFailed) return "Connection failed"
  return "Failed to connect"
}

// Whether a failed connect should reopen the passphrase prompt. NoSecrets
// means credentials are missing only for a network that actually uses them.
// An auth timeout on such a network means the saved passphrase is wrong (the
// same profile a first failed attempt leaves behind as "known"), so the user
// needs a chance to re-enter it -- connectWithPsk overwrites the stored PSK on
// submit.
function shouldRepromptPassphrase(reason, needsCredentials, reasons) {
  var r = reasons || {}
  if (!needsCredentials) return false
  return reason === r.NoSecrets || reason === r.WifiAuthTimeout
}

if (typeof module !== "undefined") {
  module.exports = {
    parseNetworkStatus: parseNetworkStatus,
    wifiIconFor: wifiIconFor,
    connectionIcon: connectionIcon,
    formatHeaderSpeed: formatHeaderSpeed,
    formatHeaderFreq: formatHeaderFreq,
    bandTokenFromFreq: bandTokenFromFreq,
    formatRowBands: formatRowBands,
    parseWifiScan: parseWifiScan,
    parseWifiScanBands: parseWifiScanBands,
    withLiveBand: withLiveBand,
    headerDetail: headerDetail,
    bandLabel: bandLabel,
    bandPillLabel: bandPillLabel,
    bandTooltip: bandTooltip,
    parseBandStatus: parseBandStatus,
    decodeIwSsid: decodeIwSsid,
    parseKeyValue: parseKeyValue,
    throughputState: throughputState,
    pingLatencyState: pingLatencyState,
    pingPacketLossPercent: pingPacketLossPercent,
    formatPacketLoss: formatPacketLoss,
    formatBytes: formatBytes,
    formatRate: formatRate,
    niceCeil: niceCeil,
    historyTick: historyTick,
    pushPingSample: pushPingSample,
    pingExtent: pingExtent,
    pushTrafficSample: pushTrafficSample,
    trafficExtents: trafficExtents,
    trafficTimeWindow: trafficTimeWindow,
    pingHeatColor: pingHeatColor,
    strokeTrafficSeries: strokeTrafficSeries,
    formatPingLatency: formatPingLatency,
    dbmToPercent: dbmToPercent,
    wifiRow: wifiRow,
    rowStatusLine: rowStatusLine,
    sortWifiRows: sortWifiRows,
    wifiSectionTitle: wifiSectionTitle,
    requiresCredentials: requiresCredentials,
    canForgetNetwork: canForgetNetwork,
    enterpriseConnectScript: enterpriseConnectScript,
    networkFailureReason: networkFailureReason,
    shouldRepromptPassphrase: shouldRepromptPassphrase
  }
}
