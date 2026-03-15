/* ═══════════════════════════════════════════════════════════════
   SIGINT Sentinel — Event Control Panel (Client Logic)
   ═══════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ─── Config ───
  let API_BASE = '';
  const POLL_INTERVAL = 2000;

  // ─── State ───
  const state = {
    role: 'admin',
    devices: [],
    alerts: [],
    feed: [],
    mapItems: [],
    activeTool: 'node',
    dragging: null,
    dragOffset: { x: 0, y: 0 },
    // Zone drawing state
    drawingZone: false,
    zoneStart: null,
    zoneCurrent: null,
    // Guest ticket
    myTicket: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ── Icon registry for map items ──
  const ITEM_ICONS = {
    node:     { emoji: '📡', label: 'WiFi Node',  color: '#00e5ff', type: 'circle' },
    router:   { emoji: '🌐', label: 'Router',     color: '#448aff', type: 'circle' },
    stage:    { emoji: '🎤', label: 'Stage',       color: '#e040fb', type: 'rect' },
    food:     { emoji: '🍔', label: 'Food',        color: '#ff9100', type: 'icon' },
    drink:    { emoji: '🍺', label: 'Bar',         color: '#ffab00', type: 'icon' },
    bathroom: { emoji: '🚻', label: 'Restroom',    color: '#80cbc4', type: 'icon' },
    medical:  { emoji: '🏥', label: 'Medical',     color: '#ef5350', type: 'icon' },
    exit:     { emoji: '🚪', label: 'Exit',        color: '#ff1744', type: 'icon' },
    entrance: { emoji: '🚧', label: 'Entrance',    color: '#00e676', type: 'icon' },
    parking:  { emoji: '🅿️', label: 'Parking',    color: '#42a5f5', type: 'icon' },
    vip:      { emoji: '⭐', label: 'VIP Area',    color: '#ffd740', type: 'icon' },
    info:     { emoji: 'ℹ️', label: 'Info Booth',  color: '#90a4ae', type: 'icon' },
    zone:     { emoji: '🟩', label: 'Zone',        color: '#00e676', type: 'zone' },
  };

  // ─── Boot ───
  document.addEventListener('DOMContentLoaded', () => {
    initRole();
    initTabs();
    initClock();
    initCheckinForm();
    initMapBuilder();
    initServerModal();
    startPolling();
    checkServerStatus();
    loadMyTicket();
  });

  // ════════════════════════════════════════════════════
  //  ROLE SYSTEM
  // ════════════════════════════════════════════════════
  function initRole() {
    const path = window.location.pathname.replace(/\/+$/, '');
    const roleMap = { '/guest': 'guest', '/vendor': 'vendor', '/staff': 'staff', '/admin': 'admin' };
    state.role = roleMap[path] || 'admin';

    document.body.dataset.role = state.role;

    const badge = $('#roleBadge');
    badge.textContent = state.role.toUpperCase();
    document.body.classList.add(`role-${state.role}`);

    // Hide elements not for this role
    $$('[data-roles]').forEach((el) => {
      const allowed = el.dataset.roles.split(' ');
      if (!allowed.includes(state.role)) {
        el.style.display = 'none';
      }
    });

    // Activate first visible tab + panel
    const tabs = Array.from($$('.tab')).filter((t) => t.style.display !== 'none');
    const panels = Array.from($$('.panel')).filter((p) => p.style.display !== 'none');
    $$('.tab').forEach((t) => t.classList.remove('active'));
    $$('.panel').forEach((p) => p.classList.remove('active'));
    if (tabs.length) tabs[0].classList.add('active');
    if (panels.length) panels[0].classList.add('active');
  }

  // ════════════════════════════════════════════════════
  //  TABS
  // ════════════════════════════════════════════════════
  function initTabs() {
    $$('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.tab').forEach((t) => t.classList.remove('active'));
        $$('.panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = $(`#panel-${btn.dataset.tab}`);
        if (panel) panel.classList.add('active');
      });
    });
  }

  // ════════════════════════════════════════════════════
  //  CLOCK
  // ════════════════════════════════════════════════════
  function initClock() {
    const el = $('#clock');
    const tick = () => { el.textContent = new Date().toLocaleTimeString('en-US', { hour12: false }); };
    tick(); setInterval(tick, 1000);
  }

  // ════════════════════════════════════════════════════
  //  SERVER STATUS
  // ════════════════════════════════════════════════════
  async function checkServerStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        $('#serverDot').className = 'status-dot online';
        $('#serverStatus').textContent = 'Server Online';
      } else { throw 0; }
    } catch {
      $('#serverDot').className = 'status-dot offline';
      $('#serverStatus').textContent = 'Server Offline';
    }
  }

  // ════════════════════════════════════════════════════
  //  DEVICE REGISTRATION
  // ════════════════════════════════════════════════════
  function initCheckinForm() {
    $('#checkinForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#checkinBtn');
      btn.querySelector('.btn-text').hidden = true;
      btn.querySelector('.btn-loading').hidden = false;
      btn.disabled = true;

      const payload = {
        name: $('#attendeeName').value.trim(),
        ticket: $('#ticketId').value.trim(),
        device_type: $('#deviceType').value,
      };

      try {
        const res = await fetch(`${API_BASE}/api/checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          toast(`Device registered: ${data.mac}`, 'success');

          // Save ticket for guest view
          if (state.role === 'guest') {
            state.myTicket = data;
            localStorage.setItem('sigint_ticket', JSON.stringify(data));
            renderTicket();
          }

          $('#checkinForm').reset();
          loadDevices();
        } else {
          toast(data.error || 'Registration failed', 'error');
        }
      } catch {
        toast('Could not reach server.', 'error');
      } finally {
        btn.querySelector('.btn-text').hidden = false;
        btn.querySelector('.btn-loading').hidden = true;
        btn.disabled = false;
      }
    });
  }

  async function loadDevices() {
    try {
      const res = await fetch(`${API_BASE}/api/devices`);
      state.devices = await res.json();
      renderDevices();
      renderStats();
    } catch { /* silent */ }
  }

  function renderDevices() {
    const list = $('#deviceList');
    const count = $('#deviceCount');
    if (!list || !count) return;
    count.textContent = state.devices.length;

    if (state.devices.length === 0) {
      list.innerHTML = '<p class="empty-state">No devices registered yet.</p>';
      return;
    }

    const icons = { phone: '📱', wearable: '⌚', laptop: '💻', other: '📟' };
    const showMac = ['staff', 'admin'].includes(state.role);

    list.innerHTML = state.devices.map((d) => `
      <div class="device-item">
        <span class="device-icon">${icons[d.device_type] || '📟'}</span>
        <div class="device-info">
          <div class="device-name">${esc(d.name)}</div>
          ${showMac ? `<div class="device-mac">${d.mac}</div>` : ''}
          <div class="device-meta">Ticket: ${esc(d.ticket)} • ${d.device_type}</div>
        </div>
        <span class="device-badge">Online</span>
      </div>
    `).join('');
  }

  // ════════════════════════════════════════════════════
  //  MY TICKET (Guest view)
  // ════════════════════════════════════════════════════
  function loadMyTicket() {
    const saved = localStorage.getItem('sigint_ticket');
    if (saved) {
      try { state.myTicket = JSON.parse(saved); } catch { return; }
      renderTicket();
    }
  }

  function renderTicket() {
    const empty = $('#ticketEmpty');
    const content = $('#ticketContent');
    if (!empty || !content || !state.myTicket) return;

    empty.style.display = 'none';
    content.hidden = false;

    const t = state.myTicket;
    $('#ticketName').textContent = t.name;
    $('#ticketIdDisplay').textContent = t.ticket;
    const deviceLabels = { phone: '📱 Phone', wearable: '⌚ Wearable', laptop: '💻 Laptop', other: '📟 Other' };
    $('#ticketDevice').textContent = deviceLabels[t.device_type] || t.device_type;
    $('#ticketDate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Generate barcode-like visual
    const barcode = $('#ticketBarcode');
    let bars = '';
    const seed = t.ticket || 'default';
    for (let i = 0; i < 40; i++) {
      const w = ((seed.charCodeAt(i % seed.length) * (i + 1)) % 4) + 1;
      bars += `<span class="bar" style="width:${w}px"></span>`;
    }
    barcode.innerHTML = bars;
  }

  // ════════════════════════════════════════════════════
  //  LIVE STATS (Staff view)
  // ════════════════════════════════════════════════════
  function renderStats() {
    const el = (id) => document.getElementById(id);
    if (!el('statTotalDevices')) return;

    el('statTotalDevices').textContent = state.devices.length;
    el('statPhones').textContent = state.devices.filter((d) => d.device_type === 'phone').length;
    el('statWearables').textContent = state.devices.filter((d) => d.device_type === 'wearable').length;
    el('statLaptops').textContent = state.devices.filter((d) => d.device_type === 'laptop').length;
    el('statActiveFeed').textContent = state.feed.length;
    el('statActiveAlerts').textContent = state.alerts.length;

    // Device table
    const body = el('statsDeviceBody');
    if (!body) return;
    if (state.devices.length === 0) {
      body.innerHTML = '<tr><td colspan="5" class="empty-state">No devices registered yet.</td></tr>';
      return;
    }
    body.innerHTML = state.devices.slice().reverse().map((d) => `
      <tr>
        <td>${esc(d.name)}</td>
        <td style="color:var(--accent-amber)">${esc(d.ticket)}</td>
        <td>${d.device_type}</td>
        <td style="color:var(--accent-cyan);font-family:var(--font-mono)">${d.mac}</td>
        <td style="color:var(--text-dim)">${(d.registered_at || '—').slice(0, 19).replace('T', ' ')}</td>
      </tr>
    `).join('');
  }

  // ════════════════════════════════════════════════════
  //  MAP BUILDER
  // ════════════════════════════════════════════════════
  function initMapBuilder() {
    const canvas = $('#eventCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Tool buttons
    $$('[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('[data-tool]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeTool = btn.dataset.tool;
        canvas.style.cursor = btn.dataset.tool === 'select' ? 'grab' : 'crosshair';
      });
    });

    // Mouse down — start zone draw or start drag
    canvas.addEventListener('mousedown', (e) => {
      const { mx, my } = getCanvasCoords(e, canvas);

      if (state.activeTool === 'zone') {
        state.drawingZone = true;
        state.zoneStart = { x: mx, y: my };
        state.zoneCurrent = { x: mx, y: my };
        return;
      }

      if (state.activeTool === 'select') {
        for (const item of state.mapItems) {
          if (hitTest(mx, my, item)) {
            state.dragging = item;
            state.dragOffset = { x: mx - item.x, y: my - item.y };
            canvas.style.cursor = 'grabbing';
            return;
          }
        }
      }
    });

    // Mouse move
    canvas.addEventListener('mousemove', (e) => {
      const { mx, my } = getCanvasCoords(e, canvas);
      $('#canvasCoords').textContent = `X: ${mx}, Y: ${my}`;

      // Drawing zone preview
      if (state.drawingZone && state.zoneStart) {
        state.zoneCurrent = { x: mx, y: my };
        drawCanvas(ctx, canvas);
        // Draw preview rectangle
        const zx = Math.min(state.zoneStart.x, mx);
        const zy = Math.min(state.zoneStart.y, my);
        const zw = Math.abs(mx - state.zoneStart.x);
        const zh = Math.abs(my - state.zoneStart.y);
        ctx.fillStyle = 'rgba(0,230,118,0.1)';
        ctx.strokeStyle = 'rgba(0,230,118,0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.rect(zx, zy, zw, zh);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }

      // Dragging item
      if (state.dragging) {
        state.dragging.x = snap(mx - state.dragOffset.x);
        state.dragging.y = snap(my - state.dragOffset.y);
        drawCanvas(ctx, canvas);
        renderMapItems();
      }
    });

    // Mouse up — finalize zone or drop drag
    canvas.addEventListener('mouseup', (e) => {
      if (state.drawingZone && state.zoneStart) {
        const { mx, my } = getCanvasCoords(e, canvas);
        const zx = Math.min(state.zoneStart.x, mx);
        const zy = Math.min(state.zoneStart.y, my);
        const zw = Math.abs(mx - state.zoneStart.x);
        const zh = Math.abs(my - state.zoneStart.y);

        if (zw > 20 && zh > 20) {
          const count = state.mapItems.filter((i) => i.type === 'zone').length;
          state.mapItems.push({
            type: 'zone', x: zx, y: zy, w: zw, h: zh,
            label: `Zone_${String.fromCharCode(65 + count)}`,
            id: Date.now(),
          });
        }

        state.drawingZone = false;
        state.zoneStart = null;
        state.zoneCurrent = null;
        drawCanvas(ctx, canvas);
        renderMapItems();
        return;
      }

      state.dragging = null;
      canvas.style.cursor = state.activeTool === 'select' ? 'grab' : 'crosshair';
    });

    // Click — place non-zone items
    canvas.addEventListener('click', (e) => {
      if (state.activeTool === 'select' || state.activeTool === 'zone') return;
      const { mx, my } = getCanvasCoords(e, canvas);
      const x = snap(mx);
      const y = snap(my);

      const info = ITEM_ICONS[state.activeTool] || ITEM_ICONS.node;
      const count = state.mapItems.filter((i) => i.type === state.activeTool).length;
      const label = `${info.label}_${String.fromCharCode(65 + count)}`;

      state.mapItems.push({ type: state.activeTool, x, y, label, id: Date.now() });
      drawCanvas(ctx, canvas);
      renderMapItems();
    });

    // Save / Clear
    $('#saveMapBtn').addEventListener('click', saveMap);
    $('#clearMapBtn').addEventListener('click', () => {
      state.mapItems = [];
      drawCanvas(ctx, canvas);
      renderMapItems();
      toast('Map cleared', 'info');
    });

    drawCanvas(ctx, canvas);
    loadMap(ctx, canvas);
  }

  function getCanvasCoords(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return { mx: Math.round((e.clientX - rect.left) * sx), my: Math.round((e.clientY - rect.top) * sy) };
  }

  function snap(v) { return Math.round(v / 30) * 30; }

  function hitTest(mx, my, item) {
    if (item.type === 'zone') {
      return mx >= item.x && mx <= item.x + (item.w || 80) && my >= item.y && my <= item.y + (item.h || 50);
    }
    return Math.abs(mx - item.x) < 22 && Math.abs(my - item.y) < 22;
  }

  function drawCanvas(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= canvas.width; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y <= canvas.height; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

    // Draw zones first (behind everything)
    state.mapItems.filter((i) => i.type === 'zone').forEach((item) => drawZone(ctx, item));

    // Draw everything else
    state.mapItems.filter((i) => i.type !== 'zone').forEach((item) => {
      const info = ITEM_ICONS[item.type] || ITEM_ICONS.node;

      if (info.type === 'circle') {
        // Sensor nodes / routers
        ctx.beginPath();
        ctx.arc(item.x, item.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(info.color, 0.2);
        ctx.fill();
        ctx.strokeStyle = info.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        [24, 34].forEach((r) => {
          ctx.beginPath();
          ctx.arc(item.x, item.y, r, -Math.PI * 0.4, Math.PI * 0.4);
          ctx.strokeStyle = hexToRgba(info.color, 0.15);
          ctx.lineWidth = 1;
          ctx.stroke();
        });
        ctx.beginPath();
        ctx.arc(item.x, item.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = info.color;
        ctx.fill();

      } else if (info.type === 'rect') {
        // Stage
        ctx.fillStyle = hexToRgba(info.color, 0.15);
        ctx.strokeStyle = info.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(item.x - 30, item.y - 18, 60, 36, 6);
        ctx.fill();
        ctx.stroke();

      } else if (info.type === 'icon') {
        // Venue icons (food, bathroom, etc.)
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(info.emoji, item.x, item.y);
        // Subtle background circle
        ctx.beginPath();
        ctx.arc(item.x, item.y, 18, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(info.color, 0.3);
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = '#e8eaed';
      ctx.font = '500 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(item.label, item.x, item.y + (info.type === 'circle' ? -24 : 20));
    });
  }

  function drawZone(ctx, item) {
    const w = item.w || 80;
    const h = item.h || 50;
    ctx.fillStyle = 'rgba(0,230,118,0.06)';
    ctx.strokeStyle = 'rgba(0,230,118,0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.roundRect(item.x, item.y, w, h, 4);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    // Zone label
    ctx.fillStyle = 'rgba(0,230,118,0.6)';
    ctx.font = '500 10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(item.label, item.x + 6, item.y + 4);
    // Size indicator
    ctx.fillStyle = 'rgba(0,230,118,0.3)';
    ctx.font = '400 9px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${w}×${h}`, item.x + w - 4, item.y + h - 14);
    // Resize handle
    ctx.fillStyle = 'rgba(0,230,118,0.5)';
    ctx.fillRect(item.x + w - 8, item.y + h - 8, 6, 6);
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function renderMapItems() {
    const list = $('#mapItemsList');
    if (!list) return;
    if (state.mapItems.length === 0) {
      list.innerHTML = '<p class="empty-state">No items placed yet.</p>';
      return;
    }
    list.innerHTML = state.mapItems.map((item) => {
      const info = ITEM_ICONS[item.type] || { emoji: '?', label: '?' };
      const sizeStr = item.w ? ` (${item.w}×${item.h})` : '';
      return `
        <div class="map-item">
          <span>${info.emoji} <span class="map-item-label">${item.label}</span>${sizeStr}</span>
          <span class="map-item-coords">(${item.x}, ${item.y})</span>
        </div>`;
    }).join('');
  }

  async function saveMap() {
    try {
      const res = await fetch(`${API_BASE}/api/event-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: state.mapItems }),
      });
      if (res.ok) toast('Event map saved!', 'success');
      else toast('Failed to save map', 'error');
    } catch { toast('Could not reach server', 'error'); }
  }

  async function loadMap(ctx, canvas) {
    try {
      const res = await fetch(`${API_BASE}/api/event-map`);
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        state.mapItems = data.items;
        drawCanvas(ctx, canvas);
        renderMapItems();
      }
    } catch { /* silent */ }
  }

  // ════════════════════════════════════════════════════
  //  LIVE ALERTS
  // ════════════════════════════════════════════════════
  async function pollAlerts() {
    try {
      const res = await fetch(`${API_BASE}/api/alerts`);
      state.alerts = await res.json();
      renderAlerts();
      renderStats();
    } catch { /* silent */ }
  }

  function renderAlerts() {
    const container = $('#alertsContainer');
    const count = $('#alertCount');
    if (!container || !count) return;
    count.textContent = state.alerts.length;
    count.classList.toggle('critical', state.alerts.some((a) => a.threat_level === 'CRITICAL'));

    if (state.alerts.length === 0) {
      container.innerHTML = `
        <div class="empty-state-large">
          <span class="empty-icon">✅</span>
          <p>No threats detected. System nominal.</p>
          <p class="empty-hint">Start <code>simulator.py</code> + <code>agent.py</code> to generate alerts.</p>
        </div>`;
      return;
    }

    container.innerHTML = state.alerts.map((alert) => {
      const level = (alert.threat_level || 'LOW').toLowerCase();
      // Least privilege: staff sees full MACs, vendor sees count only
      const showMacs = ['staff', 'admin'].includes(state.role);
      const macStr = showMacs
        ? (alert.suspect_macs || []).join(', ')
        : `${(alert.suspect_macs || []).length} suspect device(s)`;

      return `
        <div class="alert-card ${level}">
          <div class="alert-level ${level}">${alert.threat_level || 'UNKNOWN'}</div>
          <div class="alert-macs">Suspects: ${macStr}</div>
          <div class="alert-nodes">Nodes: ${(alert.nodes_involved || []).join(', ')}</div>
          <div class="alert-reasoning">${esc(alert.reasoning || '—')}</div>
          <div class="alert-time">${(alert.timestamp || '—').slice(0, 19).replace('T', ' ')}</div>
        </div>`;
    }).join('');
  }

  // ════════════════════════════════════════════════════
  //  LIVE SCAN FEED
  // ════════════════════════════════════════════════════
  async function pollFeed() {
    try {
      const res = await fetch(`${API_BASE}/api/feed`);
      state.feed = await res.json();
      renderFeed();
      renderStats();
    } catch { /* silent */ }
  }

  function renderFeed() {
    const body = $('#feedBody');
    const count = $('#feedCount');
    if (!body || !count) return;
    count.textContent = state.feed.length;

    if (state.feed.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="empty-state">No scan data yet.</td></tr>';
      return;
    }

    // Least privilege: only admin sees full MAC in feed
    const showFullMac = state.role === 'admin';

    body.innerHTML = state.feed.map((evt) => {
      const rssi = evt.rssi || 0;
      const cls = rssi > -65 ? 'rssi-good' : rssi > -80 ? 'rssi-mid' : 'rssi-weak';
      const mac = showFullMac ? evt.mac : maskMac(evt.mac);
      return `
        <tr>
          <td>${(evt.timestamp || '—').slice(0, 23).replace('T', ' ')}</td>
          <td style="color:var(--accent-cyan)">${mac || '—'}</td>
          <td>${evt.node_id || '—'}</td>
          <td class="${cls}">${rssi}</td>
        </tr>`;
    }).join('');
  }

  function maskMac(mac) {
    if (!mac) return '—';
    const parts = mac.split(':');
    if (parts.length < 6) return mac;
    return `${parts[0]}:${parts[1]}:••:••:••:${parts[5]}`;
  }

  // ════════════════════════════════════════════════════
  //  POLLING
  // ════════════════════════════════════════════════════
  function startPolling() {
    loadDevices(); pollAlerts(); pollFeed();
    setInterval(() => { pollAlerts(); pollFeed(); checkServerStatus(); }, POLL_INTERVAL);
    setInterval(loadDevices, 5000);
  }

  // ════════════════════════════════════════════════════
  //  SERVER MODAL
  // ════════════════════════════════════════════════════
  function initServerModal() {
    const modal = $('#serverModal');
    if (!modal) return;
    $('#connectBtn').addEventListener('click', () => {
      const url = $('#serverUrl').value.trim().replace(/\/$/, '');
      if (url) { API_BASE = url; toast(`Connected to ${url}`, 'success'); }
      modal.hidden = true;
      checkServerStatus();
    });
    $('#closeModalBtn').addEventListener('click', () => { modal.hidden = true; });
  }

  // ════════════════════════════════════════════════════
  //  UTILITIES
  // ════════════════════════════════════════════════════
  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function toast(msg, type = 'info') {
    const c = $('#toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

})();
