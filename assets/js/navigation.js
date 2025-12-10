window.AssamiApp = window.AssamiApp || {};

(function(App) {
  'use strict';

  let currentTab = 'home';

  function initNavigation() {
    const navContainer = document.getElementById('main-nav');
    if (!navContainer) return;

    updateNavVisibility();
  }

  function navigateToTab(tabName) {
    currentTab = tabName;
    
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      }
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = 'none';
    });

    const targetContent = document.getElementById(`tab-${tabName}`);
    if (targetContent) {
      targetContent.style.display = 'block';
    }

    const configScreen = document.getElementById('config-screen');
    if (configScreen) {
      if (tabName === 'patterns' || tabName === 'performance') {
        configScreen.classList.add('reduced-padding');
      } else {
        configScreen.classList.remove('reduced-padding');
      }
    }

    window.scrollTo(0, 0);

    if (tabName === 'performance') {
      App.renderPerformanceHub();
    }

    if (tabName === 'patterns') {
      renderPatternsTab();
    }
  }

  function updateNavVisibility() {
    const nav = document.getElementById('main-nav');
    const currentScreen = App.appState?.currentScreen || 'landing';
    
    if (nav) {
      if (currentScreen === 'exam' || currentScreen === 'landing') {
        nav.style.display = 'none';
      } else {
        nav.style.display = 'flex';
      }
    }
  }

  function renderPatternsTab() {
    const container = document.getElementById('patterns-content');
    if (!container) return;

    const patterns = App.Storage.getPatterns();

    container.innerHTML = `
      <div class="patterns-header">
        <h3>Saved Exam Patterns</h3>
        <button class="btn btn-secondary" onclick="AssamiApp.showCreatePatternModal()">+ Create Pattern</button>
      </div>
      
      <div class="patterns-grid">
        ${patterns.map(pattern => `
          <div class="pattern-card ${pattern.isDefault ? 'default' : ''}">
            <div class="pattern-header">
              <span class="pattern-name">${pattern.name}</span>
              ${pattern.isDefault ? '<span class="badge">Default</span>' : ''}
            </div>
            <div class="pattern-details">
              <div>Total: ${pattern.config.totalQuestions || (pattern.config.techQuestions + pattern.config.nonTechQuestions)} Qs</div>
              <div>Tech: ${pattern.config.techQuestions} | Non-Tech: ${pattern.config.nonTechQuestions}</div>
              <div>Duration: ${pattern.config.duration} min</div>
            </div>
            <div class="pattern-actions">
              <button class="btn btn-small" onclick="AssamiApp.applyPattern('${pattern.id}')">Use Pattern</button>
              ${!pattern.isDefault ? `<button class="btn btn-small btn-secondary" onclick="AssamiApp.deletePatternConfirm('${pattern.id}')">Delete</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function showCreatePatternModal() {
    const modalHTML = `
      <div class="pattern-form">
        <div class="form-group">
          <label>Pattern Name</label>
          <input type="text" id="pattern-name-input" placeholder="My Custom Pattern">
        </div>
        <div class="form-group">
          <label>Technical Questions</label>
          <input type="number" id="pattern-tech" value="45" min="0">
        </div>
        <div class="form-group">
          <label>Non-Technical Questions</label>
          <input type="number" id="pattern-nontech" value="15" min="0">
        </div>
        <div class="form-group">
          <label>Duration (minutes)</label>
          <input type="number" id="pattern-duration" value="90" min="15">
        </div>
      </div>
    `;

    App.showModal('Create Exam Pattern', modalHTML, [
      { text: 'Cancel', primary: false, action: App.hideModal },
      { text: 'Save Pattern', primary: true, action: saveNewPattern }
    ]);
  }

  function saveNewPattern() {
    const name = document.getElementById('pattern-name-input').value.trim();
    const tech = parseInt(document.getElementById('pattern-tech').value) || 0;
    const nonTech = parseInt(document.getElementById('pattern-nontech').value) || 0;
    const duration = parseInt(document.getElementById('pattern-duration').value) || 90;

    if (!name) {
      alert('Please enter a pattern name');
      return;
    }

    const pattern = {
      name,
      config: {
        techQuestions: tech,
        nonTechQuestions: nonTech,
        totalQuestions: tech + nonTech,
        duration,
        difficulties: ['Easy', 'Medium', 'Hard'],
        types: ['Numerical', 'Theoretical', 'Conceptual']
      }
    };

    App.Storage.savePattern(pattern);
    App.hideModal();
    renderPatternsTab();
  }

  function applyPattern(patternId) {
    const patterns = App.Storage.getPatterns();
    const pattern = patterns.find(p => p.id === patternId);
    
    if (!pattern) return;

    document.getElementById('tech-questions-full').value = pattern.config.techQuestions;
    document.getElementById('nontech-questions-full').value = pattern.config.nonTechQuestions;
    document.getElementById('duration').value = pattern.config.duration;

    navigateToTab('home');
    
    App.showModal('Pattern Applied', `"${pattern.name}" pattern has been applied to your exam configuration.`, [
      { text: 'OK', primary: true, action: App.hideModal }
    ]);
  }

  function deletePatternConfirm(patternId) {
    App.showModal('Delete Pattern', 'Are you sure you want to delete this pattern?', [
      { text: 'Cancel', primary: false, action: App.hideModal },
      { text: 'Delete', primary: true, action: () => {
        App.Storage.deletePattern(patternId);
        App.hideModal();
        renderPatternsTab();
      }}
    ]);
  }

  App.initNavigation = initNavigation;
  App.navigateToTab = navigateToTab;
  App.updateNavVisibility = updateNavVisibility;
  App.renderPatternsTab = renderPatternsTab;
  App.showCreatePatternModal = showCreatePatternModal;
  App.applyPattern = applyPattern;
  App.deletePatternConfirm = deletePatternConfirm;

  window.navigateToTab = navigateToTab;

})(window.AssamiApp);
