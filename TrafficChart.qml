import QtQuick

// Same drawing model as harshith.system-monitor/Sparkline.qml: one Canvas,
// fill + a few polylines, one stroke per series.
//
// The three series share one plot area. Download and upload share a vertical
// axis so their heights stay comparable; ping has no common unit with them and
// scales on its own. The legend above and the peak callouts carry the absolute
// values, which is what keeps the shared frame readable.
//
// Peak callouts are real Text items layered over the canvas rather than
// fillText: this Canvas already ignored setLineDash, so its text path is not
// something to lean on.
Canvas {
  id: root

  property var points: []
  // Own series, own timestamps: ping is recorded at probe cadence, the rates on
  // a fixed 10s step, so the two cannot share a point list.
  property var pingPoints: []
  property real t0: 0
  property real t1: 1
  property real downMax: 0
  property real upMax: 0
  property real pingMax: 0
  property string downColor: "#ff2ec4"
  property string upColor: "#5aa8ff"
  property string downFill: "rgba(255, 46, 196, 0.16)"
  property string lossColor: "#cdd6f4"
  property string gridColor: "rgba(255,255,255,0.12)"
  property string fontFamily: "sans-serif"
  property real lineWidth: 1.8
  property int peakCount: 5
  // Set from the legend. A hidden series is skipped by the painter and by the
  // peak search, so it takes its callouts with it.
  property bool showDown: true
  property bool showUp: true
  property bool showPing: true
  property bool showLoss: true

  antialiasing: true
  contextType: "2d"

  onPointsChanged: requestPaint()
  onPingPointsChanged: requestPaint()
  onT0Changed: requestPaint()
  onT1Changed: requestPaint()
  onDownMaxChanged: requestPaint()
  onUpMaxChanged: requestPaint()
  onPingMaxChanged: requestPaint()
  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()
  onGridColorChanged: requestPaint()
  onDownColorChanged: requestPaint()
  onUpColorChanged: requestPaint()
  onDownFillChanged: requestPaint()
  onLossColorChanged: requestPaint()
  onShowDownChanged: requestPaint()
  onShowUpChanged: requestPaint()
  onShowPingChanged: requestPaint()
  onShowLossChanged: requestPaint()

  function pingHeatColor(ms) {
    var v = Number(ms)
    if (!isFinite(v) || v < 0) return "#888888"
    if (v <= 50) return "#3dd68c"
    if (v <= 120) return "#e0c35a"
    return "#ff9a32"
  }

  function mapX(t, span) {
    return ((Number(t) - t0) / span) * width
  }

  function mapY(value, max) {
    var v = Number(value)
    if (!isFinite(v) || v < 0) v = 0
    var m = Number(max)
    var t = m > 0 ? v / m : 0
    if (t > 1) t = 1
    if (t < 0) t = 0
    return 2 + (1 - t) * (height - 4)
  }

  function drawGrid(ctx) {
    ctx.strokeStyle = gridColor
    ctx.lineWidth = 1
    var yTop = 2.5
    var yMid = Math.round(height / 2) + 0.5
    var yBot = height - 2.5
    ctx.beginPath()
    ctx.moveTo(0, yTop)
    ctx.lineTo(width, yTop)
    ctx.moveTo(0, yMid)
    ctx.lineTo(width, yMid)
    ctx.moveTo(0, yBot)
    ctx.lineTo(width, yBot)
    ctx.stroke()
  }

  function drawFill(ctx, key, max, fill) {
    var list = points
    if (!list || list.length < 2) return
    var span = t1 - t0
    if (!(span > 1) || !(width > 0) || !(height > 0)) return
    var axis = height - 2
    var firstX = null
    var lastX = null

    ctx.beginPath()
    for (var i = 0; i < list.length; i++) {
      var p = list[i]
      if (!p) continue
      var value = p[key]
      if (typeof value !== "number" || !isFinite(value) || value < 0) continue
      var x = mapX(p.t, span)
      var y = mapY(value, max)
      if (!isFinite(x) || !isFinite(y)) continue
      if (firstX === null) {
        ctx.moveTo(x, axis)
        ctx.lineTo(x, y)
        firstX = x
      } else {
        ctx.lineTo(x, y)
      }
      lastX = x
    }
    if (firstX === null) return
    ctx.lineTo(lastX, axis)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
  }

  function drawSeries(ctx, key, max, color) {
    var list = points
    if (!list || list.length < 2) return
    var span = t1 - t0
    if (!(span > 1) || !(width > 0) || !(height > 0)) return

    ctx.beginPath()
    var started = false
    for (var i = 0; i < list.length; i++) {
      var p = list[i]
      if (!p) continue
      var value = p[key]
      if (typeof value !== "number" || !isFinite(value) || value < 0) {
        started = false
        continue
      }
      var x = mapX(p.t, span)
      var y = mapY(value, max)
      if (!isFinite(x) || !isFinite(y)) {
        started = false
        continue
      }
      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    ctx.stroke()
  }

  // Batched by colour: consecutive segments in the same heat band share one
  // path, so a steady ping costs a single stroke instead of one per sample.
  function drawPingHeat(ctx) {
    var list = pingPoints
    if (!list || list.length < 2) return
    var span = t1 - t0
    if (!(span > 1) || !(width > 0) || !(height > 0)) return

    var prev = null
    var runColor = ""
    ctx.lineWidth = lineWidth
    ctx.lineJoin = "round"
    ctx.lineCap = "round"

    function flush() {
      if (runColor !== "") ctx.stroke()
      runColor = ""
    }

    for (var i = 0; i < list.length; i++) {
      var p = list[i]
      if (!p) continue
      var value = p.ping
      if (typeof value !== "number" || !isFinite(value) || value < 0) {
        flush()
        prev = null
        continue
      }
      var x = mapX(p.t, span)
      var y = mapY(value, pingMax)
      if (!isFinite(x) || !isFinite(y)) {
        flush()
        prev = null
        continue
      }
      if (!prev) {
        prev = { x: x, y: y }
        continue
      }
      var color = pingHeatColor(value)
      if (color !== runColor) {
        flush()
        ctx.beginPath()
        ctx.moveTo(prev.x, prev.y)
        ctx.strokeStyle = color
        runColor = color
      }
      ctx.lineTo(x, y)
      prev = { x: x, y: y }
    }
    flush()
  }

  // Same polyline as download / upload: one path, one stroke. Loss stays on a
  // fixed 0-100% axis rather than scaling to its own maximum — a 2% blip
  // auto-scaled to full height would look like an outage. Zero samples are
  // drawn (baseline), so a healthy stretch is a flat line rather than a gap.
  function drawLossSeries(ctx) {
    var list = pingPoints
    if (!list || list.length < 2) return
    var span = t1 - t0
    if (!(span > 1) || !(width > 0) || !(height > 0)) return

    ctx.beginPath()
    var started = false
    for (var i = 0; i < list.length; i++) {
      var p = list[i]
      if (!p) continue
      var value = p.loss
      if (typeof value !== "number" || !isFinite(value) || value < 0) {
        started = false
        continue
      }
      var x = mapX(p.t, span)
      var y = mapY(value, 100)
      if (!isFinite(x) || !isFinite(y)) {
        started = false
        continue
      }
      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.strokeStyle = lossColor
    ctx.lineWidth = lineWidth
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    ctx.stroke()
  }

  function formatRate(bps) {
    var n = Number(bps)
    if (!isFinite(n) || n < 0) n = 0
    if (n < 1024) return Math.round(n) + " B/s"
    if (n < 1024 * 1024) return (n / 1024).toFixed(n >= 10240 ? 0 : 1) + " KB/s"
    return (n / (1024 * 1024)).toFixed(1) + " MB/s"
  }

  // Local maxima only: a label on every sample of one spike says nothing that
  // the curve doesn't already show.
  function seriesPeaks(list, key, max, kind, color) {
    var span = t1 - t0
    if (!list || list.length < 3 || !(span > 1) || !(max > 0)) return []

    var samples = []
    for (var i = 0; i < list.length; i++) {
      var p = list[i]
      if (!p) continue
      var value = p[key]
      if (typeof value !== "number" || !isFinite(value) || value < 0) continue
      var x = mapX(p.t, span)
      var y = mapY(value, max)
      if (!isFinite(x) || !isFinite(y)) continue
      samples.push({ x: x, y: y, value: value })
    }
    if (samples.length < 3) return []

    var floor = height - 6
    var minLift = Math.max(6, (floor - 2) * 0.10)
    var minValue = max * 0.06
    var peaks = []

    function keep(sample, value) {
      if (value < minValue) return
      if (floor - sample.y < minLift) return
      peaks.push({
        px: sample.x,
        py: sample.y,
        value: value,
        kind: kind,
        text: kind === "ping"
          ? ((value > 0 && value < 10 ? value.toFixed(1) : Math.round(value)) + " ms")
          : formatRate(value),
        color: kind === "ping" ? pingHeatColor(value) : color
      })
    }

    for (var s = 1; s < samples.length - 1; s++) {
      var cur = samples[s].value
      if (cur > samples[s - 1].value && cur >= samples[s + 1].value) keep(samples[s], cur)
    }

    var last = samples[samples.length - 1]
    if (last.value > samples[samples.length - 2].value) keep(last, last.value)

    return peaks
  }

  // Highest on screen wins, then drop callouts that would sit on top of each
  // other so five labels never turn into one smear. Passing the dependencies
  // as arguments keeps this a function call, not a `{...}` object literal.
  readonly property var peaks: computePeaks(points, pingPoints, downMax, upMax, pingMax,
                                            width, height, t0, t1,
                                            showDown, showUp, showPing)

  function computePeaks(pts, pings, dMax, uMax, pMax, w, h, a0, a1, dOn, uOn, pOn) {
    if (!(w > 2) || !(h > 2)) return []

    var all = (dOn ? seriesPeaks(pts, "down", dMax, "down", downColor) : [])
      .concat(uOn ? seriesPeaks(pts, "up", uMax, "up", upColor) : [])
      .concat(pOn ? seriesPeaks(pings, "ping", pMax, "ping", "#3dd68c") : [])

    all.sort(function(a, b) { return a.py - b.py })

    var kept = []
    for (var i = 0; i < all.length && kept.length < peakCount; i++) {
      var candidate = all[i]
      var clash = false
      for (var k = 0; k < kept.length; k++) {
        var other = kept[k]
        if (Math.abs(candidate.px - other.px) < 34 && Math.abs(candidate.py - other.py) < 14) {
          clash = true
          break
        }
        // "77 ms" next to "78 ms" spends a callout to repeat itself. One label
        // per magnitude per series leaves room for a peak that says something.
        if (other.kind === candidate.kind
            && Math.abs(candidate.value - other.value) <= other.value * 0.12) {
          clash = true
          break
        }
      }
      if (!clash) kept.push(candidate)
    }
    return kept
  }

  onPaint: {
    var ctx = getContext("2d")
    if (!ctx) return
    ctx.reset()
    ctx.clearRect(0, 0, width, height)
    if (width <= 2 || height <= 2) return

    drawGrid(ctx)
    if (showDown) {
      drawFill(ctx, "down", downMax, downFill)
      drawSeries(ctx, "down", downMax, downColor)
    }
    if (showUp) drawSeries(ctx, "up", upMax, upColor)
    if (showPing) drawPingHeat(ctx)
    if (showLoss) drawLossSeries(ctx)
  }

  Repeater {
    model: root.peaks

    Text {
      id: callout
      required property var modelData

      text: callout.modelData.text
      color: callout.modelData.color
      font.family: root.fontFamily
      font.pixelSize: 10
      font.bold: true

      x: Math.max(0, Math.min(root.width - width, callout.modelData.px - width / 2))
      y: Math.max(0, callout.modelData.py - height - 3)
    }
  }
}
