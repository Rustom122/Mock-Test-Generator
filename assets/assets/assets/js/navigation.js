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
    
    // Step 1: Remove active from all tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      }
    });
    
    // Step 2: Hide ALL tab content first
    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = 'none';
    });
    
    // Step 2b: Update burger menu visibility based on tab
    if (typeof App.updateBurgerVisibility === 'function') {
      App.updateBurgerVisibility(tabName);
    }
    
    // Step 3: Show target tab - no padding manipulation needed, CSS handles it
    const targetContent = document.getElementById(`tab-${tabName}`);
    if (targetContent) {
      targetContent.style.display = 'block';
      
      // SINGLE SCROLL OWNER: Reset body/window scroll only
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    
    // Step 4: Special handlers for specific tabs
    if (tabName === 'performance') {
      if (typeof App.renderPerformanceHub === 'function') {
        App.renderPerformanceHub();
      }
    }
    
    if (tabName === 'patterns') {
      if (typeof renderPatternsTab === 'function') {
        renderPatternsTab();
      }
    }
    
    if (tabName === 'exam') {
      updateExamTabSections();
    }
  }

  function updateExamTabSections() {
    const state = App.appState;
    const configSection = document.getElementById('exam-config-section');
    const liveSection = document.getElementById('exam-live-section');
    const resultsSection = document.getElementById('exam-results-section');
    const resultsContentArea = document.getElementById('results-content-area');

    if (!configSection || !liveSection) return;

    configSection.style.display = 'none';
    liveSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'none';
    if (resultsContentArea) resultsContentArea.style.display = 'none';

    if (state.currentScreen === 'results' || state.results?.submitted) {
      if (resultsContentArea) resultsContentArea.style.display = 'block';
      if (resultsSection) resultsSection.style.display = 'block';
    } else if (state.currentScreen === 'exam' && state.examQuestions && state.examQuestions.length > 0) {
      liveSection.style.display = 'block';
    } else {
      configSection.style.display = 'block';
    }
  }

  function showExamLiveSection() {
    const configSection = document.getElementById('exam-config-section');
    const liveSection = document.getElementById('exam-live-section');
    const resultsSection = document.getElementById('exam-results-section');

    if (configSection) configSection.style.display = 'none';
    if (liveSection) liveSection.style.display = 'block';
    if (resultsSection) resultsSection.style.display = 'none';
  }

  function showExamResultsSection() {
    const configSection = document.getElementById('exam-config-section');
    const liveSection = document.getElementById('exam-live-section');
    const resultsSection = document.getElementById('exam-results-section');

    if (configSection) configSection.style.display = 'none';
    if (liveSection) liveSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'block';
  }

  function showExamConfigSection() {
    const configSection = document.getElementById('exam-config-section');
    const liveSection = document.getElementById('exam-live-section');
    const resultsSection = document.getElementById('exam-results-section');

    if (configSection) configSection.style.display = 'block';
    if (liveSection) liveSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'none';
  }

  function updateNavVisibility() {
    const nav = document.getElementById('main-nav');
    const currentScreen = App.appState?.currentScreen || 'landing';
    
    if (nav) {
      if (currentScreen === 'landing') {
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
    const subjects = getAvailableSubjects();

    container.innerHTML = `
      <div class="patterns-header" style="margin-bottom:20px;">
        <h3 style="margin:0;">Exam Patterns</h3>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-secondary" onclick="AssamiApp.showCreatePatternModal()">+ Quick Pattern</button>
          <button class="btn" onclick="AssamiApp.showAdvancedPatternBuilder()">Advanced Builder</button>
        </div>
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
              ${pattern.config.techQuestions !== undefined ? `<div>Tech: ${pattern.config.techQuestions} | Non-Tech: ${pattern.config.nonTechQuestions}</div>` : ''}
              <div>Duration: ${pattern.config.duration} min</div>
              ${pattern.config.subjectCounts ? `<div style="font-size:12px;color:var(--color-text-secondary);">Custom per-subject counts</div>` : ''}
            </div>
            <div class="pattern-actions">
              <button class="btn btn-small" onclick="AssamiApp.applyPattern('${pattern.id}')">Use Pattern</button>
              <button class="btn btn-small btn-secondary" onclick="AssamiApp.editPattern('${pattern.id}')">Edit</button>
              ${!pattern.isDefault ? `<button class="btn btn-small btn-secondary" onclick="AssamiApp.deletePatternConfirm('${pattern.id}')">Delete</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function getAvailableSubjects() {
    const state = App.appState;
    let questionsPool = state.allQuestions || [];
    
    if (state.selectedBranch) {
      questionsPool = questionsPool.filter(q => q.branch && q.branch.trim() === state.selectedBranch);
    }
    if (state.selectedExam) {
      questionsPool = questionsPool.filter(q => q.examType && q.examType.trim() === state.selectedExam);
    }
    
    const subjectCounts = {};
    questionsPool.forEach(q => {
      const subj = q.subject || 'Unknown';
      if (!subjectCounts[subj]) {
        subjectCounts[subj] = { total: 0, easy: 0, medium: 0, hard: 0, numerical: 0, theoretical: 0, conceptual: 0 };
      }
      subjectCounts[subj].total++;
      
      const diff = (q.difficulty || 'Medium').toLowerCase();
      if (diff === 'easy') subjectCounts[subj].easy++;
      else if (diff === 'hard') subjectCounts[subj].hard++;
      else subjectCounts[subj].medium++;
      
      const type = (q.type || 'Theoretical').toLowerCase();
      if (type === 'numerical') subjectCounts[subj].numerical++;
      else if (type === 'conceptual') subjectCounts[subj].conceptual++;
      else subjectCounts[subj].theoretical++;
    });
    
    return subjectCounts;
  }

  function showAdvancedPatternBuilder(patternId) {
    const subjects = getAvailableSubjects();
    const subjectList = Object.keys(subjects).sort();
    
    const technicalSubjects = ['Electrical Machines', 'Power Systems', 'Control Systems', 'Power Electronics', 'Transformers', 'DC Machines', 'Induction Motors', 'Synchronous Machines', 'Network Analysis', 'Electromagnetic Fields'];
    
    const techSubjects = subjectList.filter(s => technicalSubjects.some(ts => s.includes(ts)));
    const nonTechSubjects = subjectList.filter(s => !technicalSubjects.some(ts => s.includes(ts)));
    
    let existingPattern = null;
    if (patternId) {
      existingPattern = App.Storage.getPatterns().find(p => p.id === patternId);
    }
    
    const modalHTML = `
      <div class="pattern-builder" style="max-height:70vh;overflow-y:auto;">
        <div class="form-group" style="margin-bottom:20px;">
          <label style="font-weight:600;">Pattern Name</label>
          <input type="text" id="pattern-builder-name" value="${existingPattern?.name || 'Custom Pattern'}" style="width:100%;padding:10px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-background);color:var(--color-text);">
        </div>
        
        <div style="display:flex;gap:10px;margin-bottom:20px;">
          <button type="button" class="btn btn-secondary btn-small" onclick="AssamiApp.applyPreset('nrl')">Load NRL Preset</button>
          <button type="button" class="btn btn-secondary btn-small" onclick="AssamiApp.applyPreset('gate')">Load GATE Preset</button>
          <button type="button" class="btn btn-secondary btn-small" onclick="AssamiApp.distributeEqually()">Distribute Equally</button>
        </div>
        
        <div style="margin-bottom:20px;padding:15px;background:var(--color-secondary);border-radius:8px;border:1px solid var(--color-border);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <h4 style="margin:0;color:var(--color-primary);">Configuration Summary</h4>
            <div style="display:flex;gap:15px;">
              <span>Tech: <strong id="tech-total-display">0</strong></span>
              <span>Non-Tech: <strong id="nontech-total-display">0</strong></span>
              <span>Total: <strong id="grand-total-display">0</strong></span>
            </div>
          </div>
          <div id="pattern-validation-msg" style="font-size:13px;display:none;padding:8px;border-radius:6px;margin-top:10px;"></div>
        </div>

        <div style="margin-bottom:20px;">
          <h4 style="color:var(--color-primary);margin-bottom:15px;">Technical Subjects</h4>
          <div class="pattern-table" style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background:var(--color-secondary);">
                  <th style="padding:10px;text-align:left;border:1px solid var(--color-border);">Subject</th>
                  <th style="padding:10px;text-align:center;border:1px solid var(--color-border);">Available</th>
                  <th style="padding:10px;text-align:center;border:1px solid var(--color-border);"># Questions</th>
                  <th style="padding:10px;text-align:center;border:1px solid var(--color-border);">Easy/Med/Hard</th>
                  <th style="padding:10px;text-align:center;border:1px solid var(--color-border);">Num/Theo/Conc</th>
                </tr>
              </thead>
              <tbody id="tech-subjects-body">
                ${techSubjects.map(subj => {
                  const stats = subjects[subj];
                  const existingCount = existingPattern?.config?.subjectCounts?.[subj] || 0;
                  return `
                    <tr data-subject="${subj}" data-section="tech">
                      <td style="padding:8px;border:1px solid var(--color-border);">${subj}</td>
                      <td style="padding:8px;text-align:center;border:1px solid var(--color-border);color:var(--color-text-secondary);">${stats.total}</td>
                      <td style="padding:8px;text-align:center;border:1px solid var(--color-border);">
                        <input type="number" class="subject-count-input" data-subject="${subj}" value="${existingCount}" min="0" max="${stats.total}" style="width:60px;padding:5px;text-align:center;border:1px solid var(--color-border);border-radius:4px;background:var(--color-background);color:var(--color-text);" onchange="AssamiApp.updatePatternTotals()">
                      </td>
                      <td style="padding:8px;text-align:center;border:1px solid var(--color-border);font-size:11px;color:var(--color-text-secondary);">${stats.easy}/${stats.medium}/${stats.hard}</td>
                      <td style="padding:8px;text-align:center;border:1px solid var(--color-border);font-size:11px;color:var(--color-text-secondary);">${stats.numerical}/${stats.theoretical}/${stats.conceptual}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <h4 style="color:var(--color-primary);margin-bottom:15px;">Non-Technical Subjects</h4>
          <div class="pattern-table" style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background:var(--color-secondary);">
                  <th style="padding:10px;text-align:left;border:1px solid var(--color-border);">Subject</th>
                  <th style="padding:10px;text-align:center;border:1px solid var(--color-border);">Available</th>
                  <th style="padding:10px;text-align:center;border:1px solid var(--color-border);"># Questions</th>
                  <th style="padding:10px;text-align:center;border:1px solid var(--color-border);">Easy/Med/Hard</th>
                  <th style="padding:10px;text-align:center;border:1px solid var(--color-border);">Num/Theo/Conc</th>
                </tr>
              </thead>
              <tbody id="nontech-subjects-body">
                ${nonTechSubjects.map(subj => {
                  const stats = subjects[subj];
                  const existingCount = existingPattern?.config?.subjectCounts?.[subj] || 0;
                  return `
                    <tr data-subject="${subj}" data-section="nontech">
                      <td style="padding:8px;border:1px solid var(--color-border);">${subj}</td>
                      <td style="padding:8px;text-align:center;border:1px solid var(--color-border);color:var(--color-text-secondary);">${stats.total}</td>
                      <td style="padding:8px;text-align:center;border:1px solid var(--color-border);">
                        <input type="number" class="subject-count-input" data-subject="${subj}" value="${existingCount}" min="0" max="${stats.total}" style="width:60px;padding:5px;text-align:center;border:1px solid var(--color-border);border-radius:4px;background:var(--color-background);color:var(--color-text);" onchange="AssamiApp.updatePatternTotals()">
                      </td>
                      <td style="padding:8px;text-align:center;border:1px solid var(--color-border);font-size:11px;color:var(--color-text-secondary);">${stats.easy}/${stats.medium}/${stats.hard}</td>
                      <td style="padding:8px;text-align:center;border:1px solid var(--color-border);font-size:11px;color:var(--color-text-secondary);">${stats.numerical}/${stats.theoretical}/${stats.conceptual}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:20px;">
          <label style="font-weight:600;">Duration (minutes)</label>
          <input type="number" id="pattern-builder-duration" value="${existingPattern?.config?.duration || 90}" min="15" max="300" style="width:100%;padding:10px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-background);color:var(--color-text);">
        </div>
      </div>
    `;

    App.showModal('Advanced Pattern Builder', modalHTML, [
      { text: 'Cancel', primary: false, action: App.hideModal },
      { text: 'Validate', primary: false, action: validatePattern },
      { text: 'Save Pattern', primary: true, action: () => saveAdvancedPattern(patternId) },
      { text: 'Start Exam', primary: true, action: () => startExamFromPattern(patternId) }
    ]);

    setTimeout(updatePatternTotals, 100);
  }

  function updatePatternTotals() {
    let techTotal = 0;
    let nonTechTotal = 0;
    
    document.querySelectorAll('#tech-subjects-body .subject-count-input').forEach(input => {
      techTotal += parseInt(input.value) || 0;
    });
    
    document.querySelectorAll('#nontech-subjects-body .subject-count-input').forEach(input => {
      nonTechTotal += parseInt(input.value) || 0;
    });
    
    const techDisplay = document.getElementById('tech-total-display');
    const nonTechDisplay = document.getElementById('nontech-total-display');
    const grandTotal = document.getElementById('grand-total-display');
    
    if (techDisplay) techDisplay.textContent = techTotal;
    if (nonTechDisplay) nonTechDisplay.textContent = nonTechTotal;
    if (grandTotal) grandTotal.textContent = techTotal + nonTechTotal;
  }

  function validatePattern() {
    const inputs = document.querySelectorAll('.subject-count-input');
    let hasError = false;
    let totalCount = 0;
    const msgEl = document.getElementById('pattern-validation-msg');
    
    inputs.forEach(input => {
      const requested = parseInt(input.value) || 0;
      const max = parseInt(input.max) || 0;
      totalCount += requested;
      
      if (requested > max) {
        hasError = true;
        input.style.borderColor = 'var(--color-error)';
      } else {
        input.style.borderColor = 'var(--color-border)';
      }
    });
    
    if (msgEl) {
      if (hasError) {
        msgEl.style.display = 'block';
        msgEl.style.background = 'rgba(239, 68, 68, 0.1)';
        msgEl.style.color = 'var(--color-error)';
        msgEl.textContent = 'Some subjects have more questions requested than available. Please adjust.';
      } else if (totalCount === 0) {
        msgEl.style.display = 'block';
        msgEl.style.background = 'rgba(245, 158, 11, 0.1)';
        msgEl.style.color = 'var(--color-warning)';
        msgEl.textContent = 'Please add at least 1 question to start an exam.';
      } else {
        msgEl.style.display = 'block';
        msgEl.style.background = 'rgba(34, 197, 94, 0.1)';
        msgEl.style.color = 'var(--color-success)';
        msgEl.textContent = `Valid configuration: ${totalCount} questions ready.`;
      }
    }
    
    return !hasError && totalCount > 0;
  }

  function applyPreset(presetType) {
    const subjects = getAvailableSubjects();
    const technicalSubjects = ['Electrical Machines', 'Power Systems', 'Control Systems', 'Power Electronics', 'Transformers', 'DC Machines', 'Induction Motors', 'Synchronous Machines', 'Network Analysis', 'Electromagnetic Fields'];
    
    let techTarget, nonTechTarget;
    if (presetType === 'nrl') {
      techTarget = 45;
      nonTechTarget = 15;
      document.getElementById('pattern-builder-duration').value = 90;
    } else if (presetType === 'gate') {
      techTarget = 55;
      nonTechTarget = 10;
      document.getElementById('pattern-builder-duration').value = 180;
    }
    
    const techSubjects = Object.keys(subjects).filter(s => technicalSubjects.some(ts => s.includes(ts)));
    const nonTechSubjects = Object.keys(subjects).filter(s => !technicalSubjects.some(ts => s.includes(ts)));
    
    distributeAmongSubjects(techSubjects, techTarget, subjects);
    distributeAmongSubjects(nonTechSubjects, nonTechTarget, subjects);
    
    updatePatternTotals();
  }

  function distributeEqually() {
    const subjects = getAvailableSubjects();
    const allSubjects = Object.keys(subjects);
    const targetTotal = 60;
    const perSubject = Math.ceil(targetTotal / allSubjects.length);
    
    document.querySelectorAll('.subject-count-input').forEach(input => {
      const subj = input.dataset.subject;
      const max = subjects[subj]?.total || 0;
      input.value = Math.min(perSubject, max);
    });
    
    updatePatternTotals();
  }

  function distributeAmongSubjects(subjectList, targetCount, subjectsData) {
    if (subjectList.length === 0) return;
    
    const perSubject = Math.ceil(targetCount / subjectList.length);
    let remaining = targetCount;
    
    subjectList.forEach(subj => {
      const input = document.querySelector(`.subject-count-input[data-subject="${subj}"]`);
      if (input) {
        const max = subjectsData[subj]?.total || 0;
        const toAssign = Math.min(perSubject, max, remaining);
        input.value = toAssign;
        remaining -= toAssign;
      }
    });
  }

  function saveAdvancedPattern(existingId) {
    if (!validatePattern()) {
      return;
    }
    
    const name = document.getElementById('pattern-builder-name')?.value || 'Custom Pattern';
    const duration = parseInt(document.getElementById('pattern-builder-duration')?.value) || 90;
    
    const subjectCounts = {};
    let techTotal = 0;
    let nonTechTotal = 0;
    
    document.querySelectorAll('.subject-count-input').forEach(input => {
      const subj = input.dataset.subject;
      const count = parseInt(input.value) || 0;
      if (count > 0) {
        subjectCounts[subj] = count;
      }
      
      const row = input.closest('tr');
      if (row?.dataset.section === 'tech') {
        techTotal += count;
      } else {
        nonTechTotal += count;
      }
    });
    
    const pattern = {
      id: existingId || undefined,
      name,
      config: {
        techQuestions: techTotal,
        nonTechQuestions: nonTechTotal,
        totalQuestions: techTotal + nonTechTotal,
        duration,
        difficulties: ['Easy', 'Medium', 'Hard'],
        types: ['Numerical', 'Theoretical', 'Conceptual'],
        subjectCounts
      }
    };
    
    App.Storage.savePattern(pattern);
    App.hideModal();
    renderPatternsTab();
    
    App.showModal('Pattern Saved', `Pattern "${name}" has been saved successfully.`, [
      { text: 'OK', primary: true, action: App.hideModal }
    ]);
  }

  function startExamFromPattern(existingId) {
    if (!validatePattern()) {
      return;
    }
    
    const duration = parseInt(document.getElementById('pattern-builder-duration')?.value) || 90;
    
    const subjectCounts = {};
    document.querySelectorAll('.subject-count-input').forEach(input => {
      const subj = input.dataset.subject;
      const count = parseInt(input.value) || 0;
      if (count > 0) {
        subjectCounts[subj] = count;
      }
    });
    
    App.hideModal();
    App.showLoadingOverlay('Preparing exam...');
    
    setTimeout(() => {
      try {
        const state = App.appState;
        let questionsPool = state.allQuestions;
        
        if (state.selectedBranch) {
          questionsPool = questionsPool.filter(q => q.branch && q.branch.trim() === state.selectedBranch);
        }
        if (state.selectedExam) {
          questionsPool = questionsPool.filter(q => q.examType && q.examType.trim() === state.selectedExam);
        }
        
        let examQuestions = [];
        for (const [subject, count] of Object.entries(subjectCounts)) {
          const subjectQuestions = questionsPool.filter(q => q.subject === subject);
          const selected = App.shuffleArray(subjectQuestions).slice(0, count);
          examQuestions.push(...selected);
        }
        
        if (examQuestions.length === 0) {
          App.hideLoadingOverlay();
          App.showModal('No Questions', 'Could not find questions matching your criteria.', [
            { text: 'OK', primary: true, action: App.hideModal }
          ]);
          return;
        }
        
        state.examQuestions = App.prepareExamQuestions(App.shuffleArray(examQuestions));
        state.userAnswers = state.examQuestions.map(() => ({
          selectedOption: null,
          visited: false,
          markedForReview: false
        }));
        state.currentQuestionIndex = 0;
        state.examMode = 'full';
        state.config = { duration, subjectCounts };
        state.config.duration = duration;
        
        App.hideLoadingOverlay();
        App.switchScreen('exam');
        App.startTimer(duration);
        App.renderPalette();
        App.renderQuestion(0);
      } catch (error) {
        console.error('Error starting exam from pattern:', error);
        App.hideLoadingOverlay();
        App.showModal('Error', 'Failed to start exam. Please try again.', [
          { text: 'OK', primary: true, action: App.hideModal }
        ]);
      }
    }, 500);
  }

  function editPattern(patternId) {
    showAdvancedPatternBuilder(patternId);
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

    if (pattern.config.subjectCounts) {
      App.hideModal();
      App.showLoadingOverlay('Preparing exam...');
      
      setTimeout(() => {
        try {
          const state = App.appState;
          let questionsPool = state.allQuestions;
          
          if (state.selectedBranch) {
            questionsPool = questionsPool.filter(q => q.branch && q.branch.trim() === state.selectedBranch);
          }
          if (state.selectedExam) {
            questionsPool = questionsPool.filter(q => q.examType && q.examType.trim() === state.selectedExam);
          }
          
          let examQuestions = [];
          for (const [subject, count] of Object.entries(pattern.config.subjectCounts)) {
            const subjectQuestions = questionsPool.filter(q => q.subject === subject);
            const selected = App.shuffleArray(subjectQuestions).slice(0, count);
            examQuestions.push(...selected);
          }
          
          if (examQuestions.length === 0) {
            App.hideLoadingOverlay();
            showQuestionShortageDialog(pattern, {});
            return;
          }
          
          state.examQuestions = App.prepareExamQuestions(App.shuffleArray(examQuestions));
          state.userAnswers = state.examQuestions.map(() => ({
            selectedOption: null,
            visited: false,
            markedForReview: false
          }));
          state.currentQuestionIndex = 0;
          state.examMode = 'full';
          state.config = { ...pattern.config };
          
          App.hideLoadingOverlay();
          App.switchScreen('exam');
          App.startTimer(pattern.config.duration);
          App.renderPalette();
          App.renderQuestion(0);
        } catch (error) {
          console.error('Error applying pattern:', error);
          App.hideLoadingOverlay();
          App.showModal('Error', 'Failed to start exam. Please try again.', [
            { text: 'OK', primary: true, action: App.hideModal }
          ]);
        }
      }, 500);
    } else {
      document.getElementById('tech-questions-full').value = pattern.config.techQuestions;
      document.getElementById('nontech-questions-full').value = pattern.config.nonTechQuestions;
      document.getElementById('duration').value = pattern.config.duration;

      navigateToTab('home');
      
      App.showModal('Pattern Applied', `"${pattern.name}" pattern has been applied to your exam configuration.`, [
        { text: 'OK', primary: true, action: App.hideModal }
      ]);
    }
  }

  function showQuestionShortageDialog(pattern, shortages) {
    App.showModal('Question Shortage', 
      `<p>Some subjects don't have enough questions available.</p>
       <p style="margin-top:10px;">Would you like to:</p>
       <ul style="margin:15px 0;padding-left:20px;">
         <li>Edit the pattern configuration</li>
         <li>Auto-fill with available questions from other topics</li>
       </ul>`,
      [
        { text: 'Cancel', primary: false, action: App.hideModal },
        { text: 'Edit Pattern', primary: false, action: () => { App.hideModal(); editPattern(pattern.id); } },
        { text: 'Auto-fill & Start', primary: true, action: () => { App.hideModal(); } }
      ]
    );
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
  function enterFullExamMode() {
    // EXAM MODE: Zero distractions - hide all navigation
    const nav = document.getElementById('main-nav');
    const configScreen = document.getElementById('config-screen');
    const burgerBtn = document.getElementById('burger-menu-btn');
    const themeBtn = document.querySelector('.theme-toggle-btn');
    
    // Hide main navigation strip completely
    if (nav) {
      nav.style.display = 'none';
      nav.style.visibility = 'hidden';
      nav.classList.add('exam-mode-hidden');
    }
    
    // Hide burger menu
    if (burgerBtn) {
      burgerBtn.style.display = 'none';
      burgerBtn.style.visibility = 'hidden';
    }
    
    // Keep theme toggle visible but ensure it doesn't interfere
    if (themeBtn) {
      themeBtn.style.zIndex = '10000';
    }
    
    if (configScreen) {
      configScreen.style.paddingRight = '0';
      configScreen.classList.add('exam-fullscreen-mode');
    }
    
    // Ensure exam tab content uses full width
    const examTab = document.getElementById('tab-exam');
    if (examTab) {
      examTab.style.width = '100%';
    }
    
    // Store exam mode state
    App.appState.isExamModeActive = true;
  }

  function exitFullExamMode() {
    // Restore all navigation elements
    const nav = document.getElementById('main-nav');
    const configScreen = document.getElementById('config-screen');
    const burgerBtn = document.getElementById('burger-menu-btn');
    
    // Show main navigation strip
    if (nav) {
      nav.style.display = 'flex';
      nav.style.visibility = 'visible';
      nav.classList.remove('exam-mode-hidden');
    }
    
    // Show burger menu
    if (burgerBtn) {
      burgerBtn.style.display = '';
      burgerBtn.style.visibility = 'visible';
    }
    
    if (configScreen) {
      configScreen.style.paddingRight = '';
      configScreen.classList.remove('exam-fullscreen-mode');
    }
    
    // Restore exam tab to default layout state
    const examTab = document.getElementById('tab-exam');
    if (examTab) {
      examTab.style.width = '';
      examTab.style.height = '';
      examTab.style.overflow = '';
    }
    
    // Reset exam container styles if present
    const examContainer = document.querySelector('.exam-container');
    if (examContainer) {
      examContainer.style.height = '';
      examContainer.style.overflow = '';
    }
    
    // Clear exam mode state
    App.appState.isExamModeActive = false;
  }

  function viewResultsInExamTab(sessionId) {
    // Navigate to exam tab
    navigateToTab('exam');
    
    // Wait for DOM to settle
    setTimeout(() => {
      const state = App.appState;
      
      // Load session results
      const session = App.Storage.getSessionById(sessionId);
      if (session) {
        state.currentSessionId = sessionId;
        state.results = App.Storage.calculateSessionStats(session);
        state.results.submitted = true;
        state.currentScreen = 'results';
        
        // Load exam questions and user answers from session
        state.examQuestions = session.questions.map(q => {
          const fullQ = state.allQuestions.find(fq => fq.id === q.id);
          return fullQ ? { ...fullQ, correctAnswer: q.correctAnswer } : q;
        });
        
        state.userAnswers = session.questions.map(q => ({
          selectedOption: q.userAnswer,
          visited: true,
          markedForReview: q.markedForReview
        }));
        
        // Show results in exam tab
        showExamResultsSection();
        
        // Render results
        if (typeof App.renderResults === 'function') {
          App.renderResults();
          
          // Typeset math in results
          setTimeout(() => {
            if (window.MathJax && window.MathJax.typesetPromise) {
              const resultsArea = document.getElementById('results-content-area');
              if (resultsArea) {
                MathJax.typesetPromise([resultsArea]).catch(err => console.log('MathJax:', err));
              }
            }
          }, 100);
        }
      }
    }, 100);
  }

  function retakeExamInExamTab(sessionId) {
    // Show retake modal
    if (typeof App.showRetakeModal === 'function') {
      App.showRetakeModal(sessionId);
    }
  }

  function resetAndNavigateHome() {
    // Reset all exam state
    const state = App.appState;
    state.currentScreen = 'config';
    state.examQuestions = [];
    state.userAnswers = [];
    state.results = {};
    state.currentSessionId = null;
    
    // Exit exam fullscreen mode if active
    exitFullExamMode();
    
    // Navigate to home tab
    navigateToTab('home');
    
    // Scroll to top
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  }

  function navigateToLanding() {
    const state = App.appState;
    
    if (state.currentScreen === 'exam' && state.examQuestions && state.examQuestions.length > 0 && !state.results?.submitted) {
      App.showModal('Exit Exam?', 'You have an exam in progress. Are you sure you want to exit? Your progress will be lost.', [
        { text: 'Cancel', primary: false, action: App.hideModal },
        { text: 'Exit to Home', primary: true, action: () => {
          App.hideModal();
          performLandingNavigation();
        }}
      ]);
    } else {
      performLandingNavigation();
    }
  }

  function performLandingNavigation() {
    const state = App.appState;
    
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
    
    exitFullExamMode();
    
    state.currentScreen = 'landing';
    state.examQuestions = [];
    state.userAnswers = [];
    state.results = {};
    state.currentSessionId = null;
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    
    const landingScreen = document.getElementById('landing-screen');
    if (landingScreen) {
      landingScreen.classList.add('active');
    }
    
    const nav = document.getElementById('main-nav');
    if (nav) nav.style.display = 'none';
    
    const burgerBtn = document.getElementById('burger-menu-btn');
    if (burgerBtn) burgerBtn.style.display = 'none';
    
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  App.navigateToLanding = navigateToLanding;
  App.enterFullExamMode = enterFullExamMode;
  App.exitFullExamMode = exitFullExamMode;
  App.viewResultsInExamTab = viewResultsInExamTab;
  App.retakeExamInExamTab = retakeExamInExamTab;
  App.resetAndNavigateHome = resetAndNavigateHome;

  App.renderPatternsTab = renderPatternsTab;
  App.showCreatePatternModal = showCreatePatternModal;
  App.showAdvancedPatternBuilder = showAdvancedPatternBuilder;
  App.updatePatternTotals = updatePatternTotals;
  App.applyPreset = applyPreset;
  App.distributeEqually = distributeEqually;
  App.applyPattern = applyPattern;
  App.editPattern = editPattern;
  App.deletePatternConfirm = deletePatternConfirm;
  App.updateExamTabSections = updateExamTabSections;
  App.showExamLiveSection = showExamLiveSection;
  App.showExamResultsSection = showExamResultsSection;
  App.showExamConfigSection = showExamConfigSection;

  window.navigateToTab = navigateToTab;

})(window.AssamiApp);
