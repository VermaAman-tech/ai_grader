(function () {
  const overlay = document.getElementById('taPanelOverlay');
  const panelBody = document.getElementById('taPanelBody');
  const panelCourseName = document.getElementById('taPanelCourseName');
  const closeBtn = document.getElementById('taPanelClose');

  if (!overlay) return;

  document.querySelectorAll('.sp-ta-course-link').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var courseId = this.dataset.courseId;
      var courseCode = this.dataset.courseCode;
      var courseName = this.dataset.courseName;
      openTAPanel(courseId, courseCode, courseName);
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closeTAPanel);
  }
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeTAPanel();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.style.display !== 'none') closeTAPanel();
  });

  function openTAPanel(courseId, courseCode, courseName) {
    panelCourseName.textContent = courseCode + ' — ' + courseName;
    panelBody.innerHTML = '<div class="ta-panel-loading"><i data-lucide="loader-2" class="spin"></i><span>Loading course data...</span></div>';
    overlay.style.display = 'flex';
    lucide.createIcons();

    fetch('/student/ta-panel/' + courseId)
      .then(function (r) { return r.text(); })
      .then(function (html) {
        panelBody.innerHTML = html;
        lucide.createIcons();
        initTabs();
      })
      .catch(function () {
        panelBody.innerHTML = '<div class="ta-panel-loading" style="color:var(--error)"><i data-lucide="alert-triangle"></i><span>Failed to load. Please try again.</span></div>';
        lucide.createIcons();
      });
  }

  function closeTAPanel() {
    overlay.style.display = 'none';
    panelBody.innerHTML = '';
  }

  function initTabs() {
    var tabs = panelBody.querySelectorAll('.ta-panel-tab');
    var contents = panelBody.querySelectorAll('.ta-tab-content');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        contents.forEach(function (c) { c.classList.remove('active'); });
        tab.classList.add('active');
        var target = panelBody.querySelector('#' + tab.dataset.tab);
        if (target) target.classList.add('active');
      });
    });
  }
})();
