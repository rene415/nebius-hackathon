/* ═══════════════════════════════════════════════════════════════
   SIGINT Sentinel — Event Control Panel (Client Logic)
   ═══════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ─── Config ───
  let API_BASE = '';  // relative by default (same host)
  const POLL_INTERVAL = 2000;

  // ─── State ───
  const state = {
    devices: [],
    alerts: [],
    feed: [],
    mapItems: [],
    activeTool: 'node',
    dragging: null,
    dragOffset: { x: 0, y: 0 },
  };

  // ─── DOM References ───
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ─── Boot ───
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initClock();
    initCheckinForm();
    initMapBuilder();
    initServerModal();
    startPolling();
    checkServerStatus();
  });

  // ════════════════════════════════════════════════════
  //  TABS
  // ════════════════════════════════════════════════════
  function initTabs() {
    $$('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.tab').forEach((t) => t.classList.remove('active'));
        $$('.panel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        $(`#panel-${btn.dataset.tab}`).classList.add('active');
      });
    });
  }

  // ════════════════════════════════════════════════════
  //  CLOCK
  // ════════════════════════════════════════════════════
  function initClock() {
    const el = $('#clock');
    function tick() {
      el.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
    }
    tick();
    setInterval(tick, 1000);
  }

  // ════════════════════════════════════════════════════
  //  SERVER STATUS
  // ════════════════════════════════════════════════════
  async function checkServerStatus() {
    const dot = $('#serverDot');
    const status = $('#serverStatus');
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        dot.className = 'status-dot online';
        status.textContent = 'Server Online';
      } else {
        throw new Error();
      }
    } catch {
      dot.className = 'status-dot offline';
      status.textContent = 'Server Offline';
    }
  }

  // ════════════════════════════════════════════════════
  //  DEVICE REGISTRATION
  // ════════════════════════════════════════════════════
  function initCheckinForm() {
    const form = $('#checkinForm');
    form.addEventListener('submit', async (e) => {
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
          form.reset();
          loadDevices();
        } else {
          toast(data.error || 'Registration failed', 'error');
        }
      } catch (err) {
        toast('Could not reach server. Is it running?', 'error');
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
      const data = await res.json();
      state.devices = data;
      renderDevices();
    } catch { /* silent */ }
  }

  function renderDevices() {
    const list = $('#deviceList');
    const count = $('#deviceCount');
    count.textContent = state.devices.length;

    if (state.devices.length === 0) {
      list.innerHTML = '<p class="empty-state">No devices registered yet.</p>';
      return;
    }

    const icons = { phone: '📱', wearable: '⌚', laptop: '💻', other: '📟' };

    list.innerHTML = state.devices.map((d) => `
      <div class="device-item">
        <span class="device-icon">${icons[d.device_type] || '📟'}</span>
        <div class="device-info">
          <div class="device-name">${esc(d.name)}</div>
          <div class="device-mac">${d.mac}</div>
          <div class="device-meta">Ticket: ${esc(d.ticket)} • ${d.device_type}</div>
        </div>
        <span class="device-badge">Online</span>
      </div>
    `).join('');
  }

  // ════════════════════════════════════════════════════
  //  MAP BUILDER
  // ════════════════════════════════════════════════════
  function initMapBuilder() {
    const canvas = $('#eventCanvas');
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

    // Canvas click
    canvas.addEventListener('click', (e) => {
      if (state.activeTool === 'select') return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.round((e.clientX - rect.left) * scaleX / 30) * 30;
      const y = Math.round((e.clientY - rect.top) * scaleY / 30) * 30;

      const typeLabels = { node: 'Node', stage: 'Stage', zone: 'Zone' };
      const typeCount = state.mapItems.filter((i) => i.type === state.activeTool).length;
      const label = `${typeLabels[state.activeTool]}_${String.fromCharCode(65 + typeCount)}`;

      state.mapItems.push({
        type: state.activeTool,
        x, y,
        label,
        id: Date.now(),
      });

      drawCanvas(ctx, canvas);
      renderMapItems();
    });

    // Mouse move for coords + dragging
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = Math.round((e.clientX - rect.left) * scaleX);
      const my = Math.round((e.clientY - rect.top) * scaleY);
      $('#canvasCoords').textContent = `X: ${mx}, Y: ${my}`;

      if (state.dragging) {
        state.dragging.x = Math.round((mx - state.dragOffset.x) / 30) * 30;
        state.dragging.y = Math.round((my - state.dragOffset.y) / 30) * 30;
        drawCanvas(ctx, canvas);
        renderMapItems();
      }
    });

    // Drag start
    canvas.addEventListener('mousedown', (e) => {
      if (state.activeTool !== 'select') return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      for (const item of state.mapItems) {
        if (Math.abs(mx - item.x) < 20 && Math.abs(my - item.y) < 20) {
          state.dragging = item;
          state.dragOffset = { x: mx - item.x, y: my - item.y };
          canvas.style.cursor = 'grabbing';
          return;
        }
      }
    });

    canvas.addEventListener('mouseup', () => {
      state.dragging = null;
      canvas.style.cursor = state.activeTool === 'select' ? 'grab' : 'crosshair';
    });

    // Save / Clear
    $('#saveMapBtn').addEventListener('click', saveMap);
    $('#clearMapBtn').addEventListener('click', () => {
      state.mapItems = [];
      drawCanvas(ctx, canvas);
      renderMapItems();
      toast('Map cleared', 'info');
    });

    // Initial draw
    drawCanvas(ctx, canvas);
    loadMap(ctx, canvas);
  }

  function drawCanvas(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= canvas.width; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Draw items
    state.mapItems.forEach((item) => {
      if (item.type === 'node') {
        // WiFi node — circle with signal rings
        ctx.beginPath();
        ctx.arc(item.x, item.y, 14, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,229,255,0.2)';
        ctx.fill();
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Signal rings
        [24, 34].forEach((r) => {
          ctx.beginPath();
          ctx.arc(item.x, item.y, r, -Math.PI * 0.4, Math.PI * 0.4);
          ctx.strokeStyle = 'rgba(0,229,255,0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();
        });

        // Dot
        ctx.beginPath();
        ctx.arc(item.x, item.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#00e5ff';
        ctx.fill();

      } else if (item.type === 'stage') {
        // Stage — rectangle
        ctx.fillStyle = 'rgba(224,64,251,0.15)';
        ctx.strokeStyle = '#e040fb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(item.x - 30, item.y - 18, 60, 36, 6);
        ctx.fill();
        ctx.stroke();

      } else if (item.type === 'zone') {
        // Zone — dashed rectangle
        ctx.fillStyle = 'rgba(0,230,118,0.08)';
        ctx.strokeStyle = 'rgba(0,230,118,0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.roundRect(item.x - 40, item.y - 25, 80, 50, 4);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Label
      ctx.fillStyle = '#e8eaed';
      ctx.font = '500 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.label, item.x, item.y + (item.type === 'node' ? -22 : 4));
    });
  }

  function renderMapItems() {
    const list = $('#mapItemsList');
    if (state.mapItems.length === 0) {
      list.innerHTML = '<p class="empty-state">No items placed yet.</p>';
      return;
    }

    const icons = { node: '📡', stage: '🎤', zone: '🟩' };
    list.innerHTML = state.mapItems.map((item) => `
      <div class="map-item">
        <span>${icons[item.type] || ''} <span class="map-item-label">${item.label}</span></span>
        <span class="map-item-coords">(${item.x}, ${item.y})</span>
      </div>
    `).join('');
  }

  async function saveMap() {
    try {
      const res = await fetch(`${API_BASE}/api/event-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: state.mapItems }),
      });
      if (res.ok) {
        toast('Event map saved!', 'success');
      } else {
        toast('Failed to save map', 'error');
      }
    } catch {
      toast('Could not reach server', 'error');
    }
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
      const data = await res.json();
      state.alerts = data;
      renderAlerts();
    } catch { /* silent */ }
  }

  function renderAlerts() {
    const container = $('#alertsContainer');
    const count = $('#alertCount');

    count.textContent = state.alerts.length;

    const hasCritical = state.alerts.some((a) => a.threat_level === 'CRITICAL');
    if (hasCritical) {
      count.classList.add('critical');
    } else {
      count.classList.remove('critical');
    }

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
      return `
        <div class="alert-card ${level}">
          <div class="alert-level ${level}">${alert.threat_level || 'UNKNOWN'}</div>
          <div class="alert-macs">Suspects: ${(alert.suspect_macs || []).join(', ')}</div>
          <div class="alert-nodes">Nodes: ${(alert.nodes_involved || []).join(', ')}</div>
          <div class="alert-reasoning">${esc(alert.reasoning || '—')}</div>
          <div class="alert-time">${(alert.timestamp || '—').slice(0, 19).replace('T', ' ')}</div>
        </div>
      `;
    }).join('');
  }

  // ════════════════════════════════════════════════════
  //  LIVE SCAN FEED
  // ════════════════════════════════════════════════════
  async function pollFeed() {
    try {
      const res = await fetch(`${API_BASE}/api/feed`);
      const data = await res.json();
      state.feed = data;
      renderFeed();
    } catch { /* silent */ }
  }

  function renderFeed() {
    const body = $('#feedBody');
    const count = $('#feedCount');
    count.textContent = state.feed.length;

    if (state.feed.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="empty-state">No scan data yet.</td></tr>';
      return;
    }

    body.innerHTML = state.feed.map((evt) => {
      const rssi = evt.rssi || 0;
      let rssiClass = 'rssi-weak';
      if (rssi > -65) rssiClass = 'rssi-good';
      else if (rssi > -80) rssiClass = 'rssi-mid';

      return `
        <tr>
          <td>${(evt.timestamp || '—').slice(0, 23).replace('T', ' ')}</td>
          <td style="color: var(--accent-cyan)">${evt.mac || '—'}</td>
          <td>${evt.node_id || '—'}</td>
          <td class="${rssiClass}">${rssi}</td>
        </tr>
      `;
    }).join('');
  }

  // ════════════════════════════════════════════════════
  //  POLLING
  // ════════════════════════════════════════════════════
  function startPolling() {
    // Immediate first load
    loadDevices();
    pollAlerts();
    pollFeed();

    setInterval(() => {
      pollAlerts();
      pollFeed();
      checkServerStatus();
    }, POLL_INTERVAL);

    // Less frequent device refresh
    setInterval(loadDevices, 5000);
  }

  // ════════════════════════════════════════════════════
  //  SERVER MODAL (Docker placeholder)
  // ════════════════════════════════════════════════════
  function initServerModal() {
    const modal = $('#serverModal');
    const connectBtn = $('#connectBtn');
    const closeBtn = $('#closeModalBtn');

    connectBtn.addEventListener('click', () => {
      const url = $('#serverUrl').value.trim().replace(/\/$/, '');
      if (url) {
        API_BASE = url;
        toast(`Connected to ${url}`, 'success');
      }
      modal.hidden = true;
      checkServerStatus();
      startPolling();
    });

    closeBtn.addEventListener('click', () => {
      modal.hidden = true;
    });
  }

  // ════════════════════════════════════════════════════
  //  UTILITIES
  // ════════════════════════════════════════════════════
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function toast(message, type = 'info') {
    const container = $('#toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

})();
