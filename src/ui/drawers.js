function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function openHistoryDrawer(entries) {
  closeDrawers();
  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop';
  backdrop.dataset.role = 'drawer-backdrop';
  const drawer = document.createElement('div');
  drawer.className = 'drawer';
  drawer.dataset.role = 'history-drawer';

  const byStreet = {};
  for (const e of entries) {
    (byStreet[e.street] = byStreet[e.street] || []).push(e);
  }
  const streetLabels = { preflop: 'Pre-flop', flop: 'Flop', turn: 'Turn', river: 'River' };

  drawer.innerHTML = `
    <div class="drawer-header"><span>Historique de la main</span><button data-action="close" type="button">&times;</button></div>
    <div class="drawer-body">
      ${
        entries.length === 0
          ? '<p style="color:var(--text-dim);font-size:13px;">Aucune action pour le moment.</p>'
          : Object.entries(byStreet)
              .map(
                ([street, items]) => `
            <div class="history-street-label">${streetLabels[street] || street}</div>
            ${items
              .map((it) => `<div class="history-entry"><b>${escapeHtml(it.name)}</b> ${escapeHtml(it.label)}${it.amount ? ` (${it.amount})` : ''}</div>`)
              .join('')}
          `
              )
              .join('')
      }
    </div>
  `;
  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);
  const close = () => closeDrawers();
  backdrop.addEventListener('click', close);
  drawer.querySelector('[data-action="close"]').addEventListener('click', close);
}

export function openChatDrawer({ messages, onSend, apiConfig, onSaveApiConfig }) {
  closeDrawers();
  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop';
  const drawer = document.createElement('div');
  drawer.className = 'drawer';
  drawer.dataset.role = 'chat-drawer';
  drawer.innerHTML = `
    <div class="drawer-header"><span>Coach - Chat</span><button data-action="close" type="button">&times;</button></div>
    <div class="drawer-body" style="flex:0 0 auto; border-bottom:1px solid var(--border-soft); padding-bottom:12px;">
      <details ${apiConfig?.apiKey ? '' : 'open'}>
        <summary style="cursor:pointer;font-size:12px;color:var(--text-dim);">Configurer une API LLM (optionnel)</summary>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
          <input type="text" id="cfg-base-url" placeholder="Base URL (ex: https://api.openai.com/v1)" value="${apiConfig?.baseUrl || 'https://api.openai.com/v1'}" style="background:#10141a;border:1px solid var(--border-soft);color:#fff;border-radius:6px;padding:6px;font-size:12px;" />
          <input type="password" id="cfg-api-key" placeholder="Cle API (jamais envoyee ailleurs, stockee localement)" value="${apiConfig?.apiKey || ''}" style="background:#10141a;border:1px solid var(--border-soft);color:#fff;border-radius:6px;padding:6px;font-size:12px;" />
          <input type="text" id="cfg-model" placeholder="Modele (ex: gpt-4o-mini)" value="${apiConfig?.model || ''}" style="background:#10141a;border:1px solid var(--border-soft);color:#fff;border-radius:6px;padding:6px;font-size:12px;" />
          <button id="cfg-save" type="button" style="background:var(--accent-blue);color:#fff;border-radius:6px;padding:6px;font-weight:700;font-size:12px;">Enregistrer</button>
          <p style="font-size:11px;color:var(--text-dim);margin:2px 0 0;">Sans cle configuree, le coach repond quand meme grace au calcul local (equite + cotes du pot).</p>
        </div>
      </details>
    </div>
    <div class="chat-messages"></div>
    <div class="chat-input-row">
      <input type="text" id="chat-input" placeholder="Poser une question..." />
      <button id="chat-send" type="button">Envoyer</button>
    </div>
  `;
  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  const close = () => closeDrawers();
  backdrop.addEventListener('click', close);
  drawer.querySelector('[data-action="close"]').addEventListener('click', close);

  const msgEl = drawer.querySelector('.chat-messages');
  function renderMessages(msgs) {
    msgEl.innerHTML = msgs
      .map((m) => `<div class="chat-msg ${m.role === 'user' ? 'user' : 'coach'}">${escapeHtml(m.text)}</div>`)
      .join('');
    msgEl.scrollTop = msgEl.scrollHeight;
  }
  renderMessages(messages);

  drawer.querySelector('#cfg-save').addEventListener('click', () => {
    onSaveApiConfig({
      baseUrl: drawer.querySelector('#cfg-base-url').value.trim(),
      apiKey: drawer.querySelector('#cfg-api-key').value.trim(),
      model: drawer.querySelector('#cfg-model').value.trim()
    });
  });

  const input = drawer.querySelector('#chat-input');
  const send = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    messages.push({ role: 'user', text });
    renderMessages(messages);
    const reply = await onSend(text);
    messages.push({ role: 'coach', text: reply });
    renderMessages(messages);
  };
  drawer.querySelector('#chat-send').addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') send();
  });

  return { renderMessages: () => renderMessages(messages) };
}

export function closeDrawers() {
  document.querySelectorAll('.drawer-backdrop, .drawer').forEach((el) => el.remove());
}
