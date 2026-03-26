// Popup UI logic
document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const toggleBtn = document.getElementById('toggleBtn');
  const addQueryBtn = document.getElementById('addQuery');
  const queryList = document.getElementById('queryList');

  let currentConfig = null;

  // Load config
  chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (config) => {
    currentConfig = config;
    document.getElementById('country').value = config.country || 'fr';
    document.getElementById('webhookUrl').value = config.webhookUrl || '';
    document.getElementById('pollInterval').value = (config.pollIntervalMs || 5000) / 1000;
    updateUI();
  });

  // Toggle start/stop
  toggleBtn.addEventListener('click', () => {
    currentConfig.enabled = !currentConfig.enabled;
    saveConfig();
    updateUI();
  });

  // Add query
  addQueryBtn.addEventListener('click', () => {
    const text = document.getElementById('queryText').value.trim();
    if (!text) return;
    const maxPrice = document.getElementById('queryMaxPrice').value;

    if (!currentConfig.queries) currentConfig.queries = [];
    currentConfig.queries.push({
      text,
      priceTo: maxPrice ? Number(maxPrice) : undefined,
    });

    document.getElementById('queryText').value = '';
    document.getElementById('queryMaxPrice').value = '';
    saveConfig();
    renderQueries();
  });

  function saveConfig() {
    currentConfig.country = document.getElementById('country').value;
    currentConfig.webhookUrl = document.getElementById('webhookUrl').value;
    currentConfig.pollIntervalMs = Number(document.getElementById('pollInterval').value) * 1000;
    chrome.runtime.sendMessage({ type: 'SET_CONFIG', config: currentConfig });
  }

  function updateUI() {
    const on = currentConfig?.enabled;
    statusDot.className = `dot ${on ? 'on' : 'off'}`;
    statusText.textContent = on ? 'Running' : 'Stopped';
    toggleBtn.textContent = on ? 'Stop' : 'Start';
    toggleBtn.className = `btn ${on ? 'btn-danger' : 'btn-primary'}`;
    renderQueries();
  }

  function renderQueries() {
    queryList.innerHTML = '';
    (currentConfig?.queries || []).forEach((q, i) => {
      const div = document.createElement('div');
      div.className = 'query-item';
      div.innerHTML = `<span>${q.text}${q.priceTo ? ` (max ${q.priceTo}€)` : ''}</span><span class="remove" data-idx="${i}">✕</span>`;
      queryList.appendChild(div);
    });

    queryList.querySelectorAll('.remove').forEach(el => {
      el.addEventListener('click', () => {
        currentConfig.queries.splice(Number(el.dataset.idx), 1);
        saveConfig();
        renderQueries();
      });
    });
  }

  // Poll stats
  setInterval(() => {
    chrome.runtime.sendMessage({ type: 'GET_STATS' }, (resp) => {
      if (!resp) return;
      document.getElementById('statTotal').textContent = resp.stats.totalItems;
      document.getElementById('statNew').textContent = resp.stats.newItems;
      document.getElementById('statErrors').textContent = resp.stats.errors;
      document.getElementById('statLast').textContent = resp.stats.lastPoll
        ? new Date(resp.stats.lastPoll).toLocaleTimeString()
        : '-';
    });
  }, 2000);
});
