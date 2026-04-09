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

  // ── Multi-File Dropzones ──
  document.querySelectorAll('.dropzone').forEach(zone => {
    const fileInput = zone.querySelector('input[type="file"]');
    const fileListEl = zone.querySelector('.dropzone-files');
    if (!fileInput || !fileListEl) return;

    const MAX_FILES = 10;
    const dt = new DataTransfer();

    function syncFiles() {
      fileInput.files = dt.files;
    }

    function renderFileList() {
      fileListEl.innerHTML = '';
      if (!dt.files.length) return;

      for (let i = 0; i < dt.files.length; i++) {
        const f = dt.files[i];
        const div = document.createElement('div');
        div.className = 'dropzone-file';
        const ext = f.name.split('.').pop().toLowerCase();
        const icon = ext === 'pdf' ? 'file-text' : ext === 'zip' ? 'file-archive' : 'image';
        const sizeKB = (f.size / 1024).toFixed(0);
        const sizeStr = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : sizeKB + ' KB';
        div.innerHTML = `<i data-lucide="${icon}" class="file-icon" style="width:16px;height:16px;"></i>` +
          `<span class="file-name">${f.name}</span>` +
          `<span class="file-size">${sizeStr}</span>` +
          `<button type="button" class="file-remove" data-idx="${i}" title="Remove">&times;</button>`;
        fileListEl.appendChild(div);
      }

      const counter = document.createElement('div');
      counter.className = 'dropzone-count';
      counter.textContent = `${dt.files.length} / ${MAX_FILES} files`;
      fileListEl.appendChild(counter);

      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function addFiles(fileList) {
      for (const f of fileList) {
        if (dt.files.length >= MAX_FILES) break;
        const ext = f.name.split('.').pop().toLowerCase();
        if (!['pdf', 'png', 'jpg', 'jpeg', 'zip'].includes(ext)) continue;
        let duplicate = false;
        for (let i = 0; i < dt.files.length; i++) {
          if (dt.files[i].name === f.name && dt.files[i].size === f.size) { duplicate = true; break; }
        }
        if (!duplicate) dt.items.add(f);
      }
      syncFiles();
      renderFileList();
    }

    zone.addEventListener('click', (e) => {
      if (e.target.closest('.file-remove') || e.target.closest('a')) return;
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      addFiles(fileInput.files);
    });

    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => { zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    });

    fileListEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.file-remove');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx);
      const newDt = new DataTransfer();
      for (let i = 0; i < dt.files.length; i++) {
        if (i !== idx) newDt.items.add(dt.files[i]);
      }
      dt.items.clear();
      for (let i = 0; i < newDt.files.length; i++) dt.items.add(newDt.files[i]);
      syncFiles();
      renderFileList();
    });
  });

  // ── AI Assistant Panel ──
  const wrapper = document.getElementById('ai-assistant');
  if (!wrapper) return;

  const fab = document.getElementById('assistant-toggle');
  const panel = document.getElementById('assistant-panel');
  const backdrop = document.getElementById('assistant-backdrop');
  const closeBtn = document.getElementById('assistant-close');
  const clearBtn = document.getElementById('assistant-clear');
  const form = document.getElementById('assistant-form');
  const input = document.getElementById('assistant-input');
  const messagesEl = document.getElementById('assistant-messages');

  let isOpen = false;

  function openPanel() {
    if (isOpen) return;
    isOpen = true;
    panel.classList.add('open');
    fab.classList.add('active');
    if (backdrop) backdrop.classList.add('open');
    document.body.classList.add('assistant-open');
    input.focus();
    loadHistory();
  }

  function closePanel() {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove('open');
    fab.classList.remove('active');
    if (backdrop) backdrop.classList.remove('open');
    document.body.classList.remove('assistant-open');
  }

  function togglePanel() {
    if (isOpen) closePanel();
    else openPanel();
  }

  fab.addEventListener('click', togglePanel);
  closeBtn.addEventListener('click', closePanel);
  if (backdrop) backdrop.addEventListener('click', closePanel);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closePanel();
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
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/\n/g, '<br>');

    // Render LaTeX after inserting HTML
    setTimeout(() => {
      if (typeof renderMathInElement !== 'undefined') {
        document.querySelectorAll('.assistant-msg-assistant').forEach(el => {
          renderMathInElement(el, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false },
            ],
            throwOnError: false,
          });
        });
      }
    }, 50);

    return html;
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
        if (data.action) handleAction(data.action);
      }
    } catch (err) {
      removeTypingIndicator();
      addMessage('assistant', 'Connection error. Please try again.');
    }
  });

  function handleAction(action) {
    if (!action || !action.type) return;
    switch (action.type) {
      case 'navigate':
        if (action.url) {
          addMessage('assistant', `Navigating to ${action.url}...`);
          setTimeout(() => { window.location.href = action.url; }, 1200);
        }
        break;
      case 'grade_all':
        if (action.exam_id) {
          addMessage('assistant', 'Triggering grading... Please wait.');
          fetch(`/grading/grade-all/${action.exam_id}`, { method: 'POST' })
            .then(() => addMessage('assistant', 'Grading started! Refreshing page...'))
            .then(() => setTimeout(() => location.reload(), 2000))
            .catch(() => addMessage('assistant', 'Failed to trigger grading.'));
        }
        break;
      default:
        if (action.url) {
          setTimeout(() => { window.location.href = action.url; }, 1200);
        }
    }
  }

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

  // ── Speech-to-Text (Web Speech API — free, no API key) ──
  const micBtn = document.getElementById('assistant-mic');
  if (micBtn && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let isListening = false;

    micBtn.addEventListener('click', () => {
      if (isListening) {
        recognition.stop();
        return;
      }
      recognition.start();
    });

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('mic-active');
      input.placeholder = 'Listening...';
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      input.value = transcript;
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('mic-active');
      input.placeholder = 'Ask anything or use mic...';
      if (input.value.trim()) {
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    };

    recognition.onerror = () => {
      isListening = false;
      micBtn.classList.remove('mic-active');
      input.placeholder = 'Ask anything or use mic...';
    };
  } else if (micBtn) {
    micBtn.style.display = 'none';
  }
});
