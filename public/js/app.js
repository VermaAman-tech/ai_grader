document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.alert').forEach(el => {
    setTimeout(() => {
      el.style.transition = 'opacity 0.3s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 5000);
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // ── Dark / Light Mode ──
  const html = document.documentElement;
  const toggle = document.getElementById('themeToggle');
  const saved = localStorage.getItem('ig-theme');
  if (saved) html.setAttribute('data-theme', saved);
  else if (window.matchMedia('(prefers-color-scheme: dark)').matches) html.setAttribute('data-theme', 'dark');

  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      localStorage.setItem('ig-theme', next);
    });
  }

  // ── AI Assistant Panel ──
  const wrapper = document.getElementById('ai-assistant');
  if (!wrapper) return;

  const fab = document.getElementById('assistant-toggle');
  const panel = document.getElementById('assistant-panel');
  const closeBtn = document.getElementById('assistant-close');
  const clearBtn = document.getElementById('assistant-clear');
  const form = document.getElementById('assistant-form');
  const input = document.getElementById('assistant-input');
  const messagesEl = document.getElementById('assistant-messages');

  let isOpen = false;

  function togglePanel() {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    fab.classList.toggle('active', isOpen);
    if (isOpen) {
      input.focus();
      loadHistory();
    }
  }

  fab.addEventListener('click', togglePanel);
  closeBtn.addEventListener('click', togglePanel);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) togglePanel();
  });

  function getContext() {
    return {
      page: wrapper.dataset.page || 'dashboard',
      exam_id: wrapper.dataset.examId || null,
      course_id: wrapper.dataset.courseId || null,
    };
  }

  function addMessage(role, content) {
    const welcome = messagesEl.querySelector('.assistant-welcome');
    if (welcome) welcome.remove();

    const div = document.createElement('div');
    div.className = `assistant-msg assistant-msg-${role}`;

    if (role === 'assistant') {
      div.innerHTML = formatMarkdown(content);
    } else {
      div.textContent = content;
    }

    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function formatMarkdown(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/\n/g, '<br>');
  }

  function addTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'assistant-msg assistant-msg-assistant assistant-typing';
    div.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
    div.id = 'typing-indicator';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  let historyLoaded = false;
  async function loadHistory() {
    if (historyLoaded) return;
    historyLoaded = true;
    try {
      const ctx = getContext();
      const qs = ctx.exam_id ? `?exam_id=${ctx.exam_id}` : '';
      const resp = await fetch(`/assistant/history${qs}`);
      const msgs = await resp.json();
      if (msgs.length) {
        const welcome = messagesEl.querySelector('.assistant-welcome');
        if (welcome) welcome.remove();
        msgs.forEach(m => addMessage(m.role, m.content));
      }
    } catch {}
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';
    addMessage('user', msg);
    addTypingIndicator();

    try {
      const resp = await fetch('/assistant/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, context: getContext() }),
      });
      const data = await resp.json();
      removeTypingIndicator();

      if (data.error) {
        addMessage('assistant', data.error);
      } else {
        addMessage('assistant', data.reply || 'No response.');
        if (data.action && data.action.type === 'navigate' && data.action.url) {
          setTimeout(() => { window.location.href = data.action.url; }, 1500);
        }
      }
    } catch (err) {
      removeTypingIndicator();
      addMessage('assistant', 'Connection error. Please try again.');
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      const ctx = getContext();
      try {
        await fetch('/assistant/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exam_id: ctx.exam_id }),
        });
      } catch {}
      messagesEl.innerHTML = `
        <div class="assistant-welcome">
          <i data-lucide="sparkles"></i>
          <p>Chat cleared. Ask me anything!</p>
        </div>`;
      historyLoaded = false;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  }
});
