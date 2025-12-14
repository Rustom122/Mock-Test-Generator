window.AssamiApp = window.AssamiApp || {};

(function(App) {
  'use strict';

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = current === 'dark' ? 'light-purple' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.getElementById('theme-icon').textContent = newTheme === 'dark' ? '🌙' : '☀️';
  }

  function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('theme-icon').textContent = saved === 'dark' ? '🌙' : '☀️';
  }

  function initBurgerMenu() {
    const btn = document.getElementById('burger-menu-btn');
    const overlay = document.getElementById('burger-menu-overlay');
    const panel = document.getElementById('burger-menu-panel');

    btn.addEventListener('click', () => {
      const isActive = panel.classList.contains('active');
      if (isActive) {
        closeBurgerMenu();
      } else {
        showBurgerMenu();
      }
      btn.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
      btn.classList.remove('active');
      closeBurgerMenu();
    });
  }

  function showBurgerMenu() {
    document.getElementById('burger-menu-overlay').classList.add('active');
    document.getElementById('burger-menu-overlay').classList.remove('hidden');
    document.getElementById('burger-menu-panel').classList.add('active');
    document.getElementById('burger-menu-panel').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeBurgerMenu() {
    document.getElementById('burger-menu-overlay').classList.remove('active');
    document.getElementById('burger-menu-panel').classList.remove('active');
    document.body.style.overflow = '';
  }

  function updateBurgerVisibility(tabName) {
    const burgerBtn = document.getElementById('burger-menu-btn');
    if (!burgerBtn) return;
    
    if (tabName === 'exam' || tabName === 'results' || tabName === 'landing') {
      burgerBtn.classList.add('hidden');
      burgerBtn.style.display = 'none';
      closeBurgerMenu();
    } else {
      burgerBtn.classList.remove('hidden');
      burgerBtn.style.display = '';
    }
  }

  function showModal(title, body, buttons) {
    document.getElementById('modal-header').textContent = title;
    document.getElementById('modal-body').innerHTML = body;

    const buttonContainer = document.getElementById('modal-buttons');
    buttonContainer.innerHTML = '';
    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.className = `modal-btn ${btn.primary ? 'modal-btn-primary' : 'modal-btn-secondary'}`;
      button.textContent = btn.text;
      button.onclick = btn.action;
      buttonContainer.appendChild(button);
    });

    document.getElementById('modal-overlay').classList.add('active');
  }

  function hideModal() {
    document.getElementById('modal-overlay').classList.remove('active');
  }

  function showLoadingOverlay(text) {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').classList.add('active');
  }

  function hideLoadingOverlay() {
    document.getElementById('loading-overlay').classList.remove('active');
  }

  function switchScreen(screenName) {
    const burgerBtn = document.getElementById('burger-menu-btn');
    
    if (screenName === 'exam' || screenName === 'results') {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('config-screen').classList.add('active');
      App.appState.currentScreen = screenName;
      
      if (typeof App.navigateToTab === 'function') {
        App.navigateToTab('exam');
      } else if (typeof navigateToTab === 'function') {
        navigateToTab('exam');
      }
      
      const placeholder = document.getElementById('exam-tab-placeholder');
      const examConfigSection = document.getElementById('exam-config-section');
      const examLiveSection = document.getElementById('exam-live-section');
      const examContentArea = document.getElementById('exam-content-area');
      const resultsContentArea = document.getElementById('results-content-area');
      const examScreen = document.getElementById('exam-screen');
      const resultsScreen = document.getElementById('results-screen');
      
      if (placeholder) placeholder.style.display = 'none';
      if (examConfigSection) examConfigSection.style.display = 'none';
      
      if (screenName === 'exam') {
        if (examLiveSection) examLiveSection.style.display = 'block';
        if (examContentArea && examScreen) {
          examContentArea.appendChild(examScreen);
          examScreen.classList.add('active');
          examScreen.style.display = 'block';
          examScreen.style.minHeight = 'auto';
          examScreen.style.padding = '0';
          examScreen.style.paddingTop = '0';
          examContentArea.style.display = 'block';
        }
        if (resultsContentArea) resultsContentArea.style.display = 'none';
        if (resultsScreen) {
          resultsScreen.classList.remove('active');
          resultsScreen.style.display = 'none';
        }
      } else if (screenName === 'results') {
        if (resultsContentArea && resultsScreen) {
          resultsContentArea.appendChild(resultsScreen);
          resultsScreen.classList.add('active');
          resultsScreen.style.display = 'block';
          resultsScreen.style.minHeight = 'auto';
          resultsScreen.style.padding = '20px';
          resultsScreen.style.paddingTop = '0';
          resultsContentArea.style.display = 'block';
        }
        if (examLiveSection) examLiveSection.style.display = 'none';
        if (examContentArea) examContentArea.style.display = 'none';
        if (examScreen) {
          examScreen.classList.remove('active');
          examScreen.style.display = 'none';
        }
      }
      
      updateBurgerVisibility('exam');
    } else {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById(`${screenName}-screen`).classList.add('active');
      App.appState.currentScreen = screenName;

      const burgerBtn = document.getElementById('burger-menu-btn');
      if (screenName === 'config') {
        if (burgerBtn) {
          burgerBtn.classList.remove('hidden');
          burgerBtn.style.display = '';
        }
      } else if (screenName === 'landing') {
        if (burgerBtn) {
          burgerBtn.classList.add('hidden');
          burgerBtn.style.display = 'none';
        }
        closeBurgerMenu();
      }
    }

    // SINGLE SCROLL OWNER: Reset window scroll only
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function toggleExamMode() {
    const toggle = document.getElementById('mode-toggle');
    const current = toggle.getAttribute('data-mode');
    const newMode = current === 'full' ? 'subject' : 'full';

    toggle.setAttribute('data-mode', newMode);
    App.appState.examMode = newMode;

    document.getElementById('full-mode-label').classList.toggle('active');
    document.getElementById('subject-mode-label').classList.toggle('active');

    if (newMode === 'full') {
      document.getElementById('full-test-mode').style.display = 'block';
      document.getElementById('subject-wise-mode').style.display = 'none';
    } else {
      document.getElementById('full-test-mode').style.display = 'none';
      document.getElementById('subject-wise-mode').style.display = 'block';
      document.getElementById('subject-selection').style.display = 'block';
      App.populateSubjects();
    }
  }

  function toggleCollapsible(sectionId) {
    const section = document.getElementById(sectionId);
    section.classList.toggle('collapsed');
  }

  function toggleSelectAll(type) {
    let checkboxes;
    if (type === 'subjects') checkboxes = document.querySelectorAll('#subject-checkboxes input');
    else if (type === 'chapters') checkboxes = document.querySelectorAll('#chapter-checkboxes input');
    else checkboxes = document.querySelectorAll('#topic-checkboxes input');

    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    checkboxes.forEach(cb => cb.checked = !allChecked);

    if (type === 'subjects') App.onSubjectChange();
    else if (type === 'chapters') App.onChapterChange();
  }

  function initDraggableThemeButton() {
    const btn = document.querySelector('.theme-toggle-btn');
    if (!btn) return;

    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    const DESKTOP_BREAKPOINT = 768;

    function loadSavedPosition() {
      try {
        const saved = JSON.parse(localStorage.getItem('themeBtnPos') || 'null');
        if (saved && window.innerWidth > DESKTOP_BREAKPOINT) {
          btn.style.left = saved.x + 'px';
          btn.style.top = saved.y + 'px';
          btn.style.right = 'auto';
        } else {
          resetToDefault();
        }
      } catch (e) {
        resetToDefault();
      }
    }

    function resetToDefault() {
      btn.style.left = '';
      btn.style.right = '20px';
      btn.style.top = '20px';
    }

    function enableDragging() {
      return window.innerWidth > DESKTOP_BREAKPOINT && !('ontouchstart' in window);
    }

    function startDrag(e) {
      if (!enableDragging()) return;

      e.preventDefault();
      isDragging = true;
      btn.classList.add('dragging');

      const rect = btn.getBoundingClientRect();

      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;

      if (btn.style.right && btn.style.right !== 'auto') {
        btn.style.left = rect.left + 'px';
        btn.style.top = rect.top + 'px';
        btn.style.right = 'auto';
      }
    }

    function doDrag(e) {
      if (!isDragging) return;

      e.preventDefault();

      let newX = e.clientX - offsetX;
      let newY = e.clientY - offsetY;

      const maxX = window.innerWidth - btn.offsetWidth;
      const maxY = window.innerHeight - btn.offsetHeight;

      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));

      btn.style.left = newX + 'px';
      btn.style.top = newY + 'px';
    }

    function endDrag(e) {
      if (!isDragging) return;

      isDragging = false;
      btn.classList.remove('dragging');

      if (window.innerWidth > DESKTOP_BREAKPOINT) {
        const x = parseInt(btn.style.left) || 0;
        const y = parseInt(btn.style.top) || 0;
        try {
          localStorage.setItem('themeBtnPos', JSON.stringify({x, y}));
        } catch (e) { }
      }
    }

    btn.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', endDrag);

    window.addEventListener('resize', () => {
      if (!enableDragging()) {
        resetToDefault();
      } else {
        loadSavedPosition();
      }
    });

    loadSavedPosition();
  }

  App.toggleTheme = toggleTheme;
  App.initTheme = initTheme;
  App.initBurgerMenu = initBurgerMenu;
  App.showBurgerMenu = showBurgerMenu;
  App.closeBurgerMenu = closeBurgerMenu;
  App.updateBurgerVisibility = updateBurgerVisibility;
  App.showModal = showModal;
  App.hideModal = hideModal;
  App.showLoadingOverlay = showLoadingOverlay;
  App.hideLoadingOverlay = hideLoadingOverlay;
  App.switchScreen = switchScreen;
  App.toggleExamMode = toggleExamMode;
  App.toggleCollapsible = toggleCollapsible;
  App.toggleSelectAll = toggleSelectAll;
  App.initDraggableThemeButton = initDraggableThemeButton;

  window.toggleTheme = toggleTheme;
  window.showBurgerMenu = showBurgerMenu;
  window.closeBurgerMenu = closeBurgerMenu;
  window.toggleExamMode = toggleExamMode;
  window.toggleSelectAll = toggleSelectAll;

})(window.AssamiApp);
