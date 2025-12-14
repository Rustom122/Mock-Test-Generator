window.AssamiApp = window.AssamiApp || {};

(function(App) {
  'use strict';

  function showRetakeModal(sessionId) {
    const session = App.Storage.getSessionById(sessionId);
    if (!session) {
      App.showModal('Error', 'Session not found.', [
        { text: 'OK', primary: true, action: App.hideModal }
      ]);
      return;
    }

    const weakSubjects = App.Storage.getWeakSubjects(sessionId);
    const incorrectCount = App.Storage.getIncorrectQuestionIds(sessionId).length;
    const unansweredCount = App.Storage.getUnansweredQuestionIds(sessionId).length;
    
    const availableWeakQs = countAvailableWeakQuestions(sessionId, weakSubjects);

    const modalHTML = `
      <div class="retake-modal-content" style="position: relative;">
        <button type="button" class="modal-close-x" onclick="AssamiApp.hideModal()" style="position:absolute;top:-15px;right:-15px;background:var(--color-primary);color:#fff;border:none;border-radius:50%;width:32px;height:32px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;" aria-label="Close modal">&times;</button>
        <p style="margin-bottom: 20px; color: var(--color-text-secondary);">Choose how you want to retake this test:</p>
        
        <div class="retake-options" role="listbox" aria-label="Retake options">
          <div class="retake-option" data-type="same" tabindex="0" role="option" aria-selected="false">
            <div class="retake-option-header">
              <span class="retake-icon">🔄</span>
              <span class="retake-title">Same Questions (Shuffled)</span>
            </div>
            <p class="retake-desc">Same set of questions with options reordered</p>
          </div>
          
          <div class="retake-option" data-type="new" tabindex="0" role="option" aria-selected="false">
            <div class="retake-option-header">
              <span class="retake-icon">✨</span>
              <span class="retake-title">All New Questions</span>
            </div>
            <p class="retake-desc">Fresh set of questions with same configuration</p>
          </div>
          
          <div class="retake-option" data-type="improve" tabindex="0" role="option" aria-selected="false">
            <div class="retake-option-header">
              <span class="retake-icon">📈</span>
              <span class="retake-title">Improve Mode</span>
            </div>
            <p class="retake-desc">Focus on ${incorrectCount + unansweredCount} weak/unanswered questions + new ones</p>
          </div>
          
          <div class="retake-option" data-type="weak" tabindex="0" role="option" aria-selected="false" ${weakSubjects.length === 0 ? 'style="opacity:0.5;pointer-events:none;" aria-disabled="true"' : ''}>
            <div class="retake-option-header">
              <span class="retake-icon">🎯</span>
              <span class="retake-title">Weak Areas Only</span>
            </div>
            <p class="retake-desc">${weakSubjects.length > 0 ? `Practice ${weakSubjects.length} weak subjects (${availableWeakQs} questions available)` : 'No weak subjects identified'}</p>
          </div>
          
          <div class="retake-option" data-type="custom" tabindex="0" role="option" aria-selected="false" style="background: linear-gradient(135deg, rgba(185, 28, 28, 0.15) 0%, rgba(185, 28, 28, 0.05) 100%); border: 1px solid var(--color-primary);">
            <div class="retake-option-header">
              <span class="retake-icon">⚙️</span>
              <span class="retake-title">Custom Exam Builder</span>
            </div>
            <p class="retake-desc">Create a fully customized exam with specific subjects, difficulty & types</p>
          </div>
        </div>
      </div>
    `;

    // Pre-calculate available question counts for each weak subject
    const weakSubjectsWithCounts = weakSubjects.map(ws => ({
      ...ws,
      availableQs: getAvailableQsForSubject(sessionId, ws.subject)
    }));
    
    // Store weak subjects data for popup use
    window._weakRetakeData = {
      sessionId,
      weakSubjects: weakSubjectsWithCounts
    };

    App.showModal('Smart Retake', modalHTML, []);

    setTimeout(() => {
      document.querySelectorAll('.retake-option').forEach(opt => {
        opt.addEventListener('click', function() {
          document.querySelectorAll('.retake-option').forEach(o => {
            o.classList.remove('selected');
            o.setAttribute('aria-selected', 'false');
          });
          this.classList.add('selected');
          this.setAttribute('aria-selected', 'true');
          
          const retakeType = this.dataset.type;
          
          if (retakeType === 'weak') {
            App.hideModal();
            showWeakAreasPopup(sessionId);
          } else if (retakeType === 'custom') {
            App.hideModal();
            showCustomExamBuilder(sessionId);
          } else if (retakeType === 'same' || retakeType === 'new' || retakeType === 'improve') {
            App.hideModal();
            showRetakeConfirmationPopup(sessionId, retakeType);
          }
        });
        
        opt.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.click();
          }
        });
      });
    }, 100);
  }

  function showRetakeConfirmationPopup(sessionId, retakeType) {
    const titles = {
      'same': 'Same Questions (Shuffled)',
      'new': 'All New Questions',
      'improve': 'Improve Mode'
    };
    
    const descriptions = {
      'same': 'You will retake the test with the same questions, but the options will be shuffled in a different order.',
      'new': 'You will get a fresh set of questions following the same exam configuration as before.',
      'improve': 'You will focus on questions you got wrong or left unanswered, plus some new questions to help you improve.'
    };
    
    const icons = {
      'same': '🔄',
      'new': '✨',
      'improve': '📈'
    };

    let existingOverlay = document.getElementById('retake-confirm-overlay');
    let existingPopup = document.getElementById('retake-confirm-popup');
    if (existingOverlay) existingOverlay.remove();
    if (existingPopup) existingPopup.remove();

    const overlay = document.createElement('div');
    overlay.id = 'retake-confirm-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s ease;';
    
    const popup = document.createElement('div');
    popup.id = 'retake-confirm-popup';
    popup.style.cssText = `
      background: linear-gradient(180deg, #0a0a0a 0%, #111 100%);
      border: 1px solid var(--color-primary);
      border-radius: 16px;
      padding: 32px;
      max-width: 420px;
      width: 90%;
      text-align: center;
      transform: scale(0.9);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 20px 60px rgba(185, 28, 28, 0.3);
    `;
    
    popup.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">${icons[retakeType]}</div>
      <h3 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: var(--color-text);">${titles[retakeType]}</h3>
      <p style="margin: 0 0 28px; font-size: 14px; color: var(--color-text-secondary); line-height: 1.6;">${descriptions[retakeType]}</p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="retake-confirm-cancel" style="
          padding: 12px 28px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-text-secondary);
        ">Cancel</button>
        <button id="retake-confirm-start" style="
          padding: 12px 28px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
          border: none;
          color: #fff;
          box-shadow: 0 4px 15px rgba(185, 28, 28, 0.4);
        ">Start Exam</button>
      </div>
    `;
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    setTimeout(() => {
      overlay.style.opacity = '1';
      popup.style.transform = 'scale(1)';
      popup.style.opacity = '1';
    }, 10);
    
    const closePopup = () => {
      overlay.style.opacity = '0';
      popup.style.transform = 'scale(0.9)';
      popup.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
      }, 300);
    };
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePopup();
    });
    
    document.getElementById('retake-confirm-cancel').addEventListener('click', closePopup);
    
    document.getElementById('retake-confirm-start').addEventListener('click', () => {
      closePopup();
      executeRetakeByType(sessionId, retakeType);
    });
  }

  function executeRetakeByType(sessionId, retakeType) {
    const session = App.Storage.getSessionById(sessionId);
    if (!session) return;
    
    App.showLoadingOverlay('Preparing retake...');

    setTimeout(() => {
      try {
        let examQuestions = [];
        const state = App.appState;

        state.selectedBranch = session.branch;
        state.selectedExam = session.examType;
        state.examMode = session.mode;

        let questionsPool = state.allQuestions.filter(q => 
          (!session.branch || (q.branch && q.branch.trim() === session.branch)) &&
          (!session.examType || (q.examType && q.examType.trim() === session.examType))
        );

        switch (retakeType) {
          case 'same':
            examQuestions = getSameQuestions(session, questionsPool);
            break;
          case 'new':
            examQuestions = getNewQuestions(session, questionsPool);
            break;
          case 'improve':
            examQuestions = getImproveQuestions(session, questionsPool);
            break;
        }

        if (examQuestions.length === 0) {
          App.hideLoadingOverlay();
          App.showModal('No Questions', 'Could not find enough questions for this retake configuration.', [
            { text: 'OK', primary: true, action: App.hideModal }
          ]);
          return;
        }

        state.examQuestions = App.prepareExamQuestions(examQuestions);
        state.userAnswers = state.examQuestions.map(() => ({
          selectedOption: null, 
          visited: false, 
          markedForReview: false
        }));
        state.currentQuestionIndex = 0;
        
        state.evaluatedAnswers = [];
        state.results = {};
        
        state.config = session.config;
        state.config.duration = session.config.duration || 90;
        
        state.currentRetakeMetadata = {
          parentSessionId: sessionId,
          retakeType: retakeType
        };

        App.hideLoadingOverlay();
        
        if (typeof App.enterFullExamMode === 'function') {
          App.enterFullExamMode();
        }
        state.isExamModeActive = true;
        state.appMode = App.APP_MODES?.EXAM_CONDUCTION || 'exam';
        
        App.switchScreen('exam');
        App.startTimer(state.config.duration);
        App.renderPalette();
        App.renderQuestion(0);
      } catch (error) {
        console.error('Retake error:', error);
        App.hideLoadingOverlay();
        App.showModal('Error', 'Failed to start retake. Please try again.', [
          { text: 'OK', primary: true, action: App.hideModal }
        ]);
      }
    }, 500);
  }

  function showWeakAreasPopup(sessionId) {
    const data = window._weakRetakeData;
    if (!data) return;

    const { weakSubjects } = data;
    
    // Use pre-calculated counts and add default question numbers
    const subjectsWithCounts = weakSubjects.map(ws => {
      const availableQs = ws.availableQs || 0;
      const defaultQs = Math.min(5, availableQs);
      return { ...ws, availableQs, defaultQs };
    });
    
    let existingOverlay = document.getElementById('weak-popup-overlay');
    let existingPopup = document.getElementById('weak-popup');
    if (existingOverlay) existingOverlay.remove();
    if (existingPopup) existingPopup.remove();

    const overlay = document.createElement('div');
    overlay.id = 'weak-popup-overlay';
    overlay.className = 'weak-areas-popup-overlay';
    overlay.onclick = () => closeWeakAreasPopup();
    
    const popup = document.createElement('div');
    popup.id = 'weak-popup';
    popup.className = 'weak-areas-side-popup';
    
    popup.innerHTML = `
      <div class="weak-popup-header">
        <h3>Customize Weak Areas Practice</h3>
        <button class="weak-popup-close" onclick="AssamiApp.closeWeakAreasPopup()">&times;</button>
      </div>
      <div class="weak-popup-content">
        <div class="weak-popup-section">
          <div class="weak-popup-section-title">Select Subjects & Questions</div>
          <div id="weak-subjects-container">
            ${subjectsWithCounts.map(ws => `
                <div class="weak-subject-item" data-subject="${ws.subject}">
                  <div class="weak-subject-left">
                    <input type="checkbox" id="weak-subj-${ws.subject.replace(/\s+/g, '-')}" value="${ws.subject}" data-available="${ws.availableQs}" checked onchange="AssamiApp.updateWeakPopupTotal()">
                    <div>
                      <div class="weak-subject-name">${ws.subject}</div>
                      <span class="weak-subject-score ${parseFloat(ws.percentage) < 40 ? 'critical' : 'warning'}">${ws.percentage}%</span>
                    </div>
                  </div>
                  <div class="weak-subject-right">
                    <input type="number" class="weak-subject-count-input" data-subject="${ws.subject}" value="${ws.defaultQs}" min="0" max="${ws.availableQs}" onchange="AssamiApp.updateWeakPopupTotal()">
                    <span class="weak-subject-available">/ ${ws.availableQs}</span>
                  </div>
                </div>
              `).join('')}
          </div>
        </div>
        
        <div class="weak-popup-section">
          <div class="weak-popup-section-title">Options</div>
          <div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--color-background);border-radius:8px;">
            <input type="checkbox" id="weak-popup-fill-new" checked>
            <label for="weak-popup-fill-new" style="font-size:13px;color:var(--color-text-secondary);">Include new questions if needed</label>
          </div>
        </div>
      </div>
      
      <div class="weak-popup-footer">
        <div class="weak-popup-summary">
          <span class="weak-popup-summary-label">Total Questions</span>
          <span class="weak-popup-summary-value" id="weak-popup-total">0</span>
        </div>
        <div class="weak-popup-actions">
          <button class="btn btn-secondary" onclick="AssamiApp.closeWeakAreasPopup()">Cancel</button>
          <button class="btn" id="weak-popup-start-btn" onclick="AssamiApp.startWeakRetakeFromPopup('${sessionId}')">Start Practice</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(popup);
    
    setTimeout(() => {
      overlay.classList.add('active');
      popup.classList.add('active');
      updateWeakPopupTotal();
    }, 10);
  }

  function closeWeakAreasPopup() {
    const overlay = document.getElementById('weak-popup-overlay');
    const popup = document.getElementById('weak-popup');
    
    if (overlay) overlay.classList.remove('active');
    if (popup) popup.classList.remove('active');
    
    setTimeout(() => {
      if (overlay) overlay.remove();
      if (popup) popup.remove();
    }, 300);
  }

  function updateWeakPopupTotal() {
    let total = 0;
    document.querySelectorAll('#weak-subjects-container .weak-subject-item').forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      const countInput = item.querySelector('.weak-subject-count-input');
      if (checkbox && checkbox.checked && countInput) {
        total += parseInt(countInput.value) || 0;
      }
    });
    
    const totalEl = document.getElementById('weak-popup-total');
    if (totalEl) totalEl.textContent = total;
    
    const startBtn = document.getElementById('weak-popup-start-btn');
    if (startBtn) startBtn.disabled = total === 0;
  }

  function startWeakRetakeFromPopup(sessionId) {
    const session = App.Storage.getSessionById(sessionId);
    if (!session) return;
    
    const subjectQuestionCounts = {};
    let totalQuestions = 0;
    
    document.querySelectorAll('#weak-subjects-container .weak-subject-item').forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      const countInput = item.querySelector('.weak-subject-count-input');
      const subject = item.dataset.subject;
      
      if (checkbox && checkbox.checked && countInput) {
        const count = parseInt(countInput.value) || 0;
        if (count > 0) {
          subjectQuestionCounts[subject] = count;
          totalQuestions += count;
        }
      }
    });
    
    if (totalQuestions === 0) {
      alert('Please select at least one question');
      return;
    }
    
    closeWeakAreasPopup();
    App.showLoadingOverlay('Preparing weak areas practice...');
    
    setTimeout(() => {
      try {
        const state = App.appState;
        state.selectedBranch = session.branch;
        state.selectedExam = session.examType;
        state.examMode = session.mode;
        
        let questionsPool = state.allQuestions.filter(q => 
          (!session.branch || (q.branch && q.branch.trim() === session.branch)) &&
          (!session.examType || (q.examType && q.examType.trim() === session.examType))
        );
        
        let examQuestions = [];
        
        for (const [subject, count] of Object.entries(subjectQuestionCounts)) {
          const subjectQuestions = questionsPool.filter(q => q.subject === subject);
          const selected = App.shuffleArray(subjectQuestions).slice(0, count);
          examQuestions.push(...selected);
        }
        
        if (examQuestions.length === 0) {
          App.hideLoadingOverlay();
          App.showModal('No Questions', 'Could not find enough questions.', [
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
        
        // FIX: Clear stale data from previous exam to ensure fresh calculation on submit
        state.evaluatedAnswers = [];
        state.results = {};
        
        state.config = session.config;
        state.config.duration = session.config.duration || 90;
        
        state.currentRetakeMetadata = {
          parentSessionId: sessionId,
          retakeType: 'weak'
        };
        
        App.hideLoadingOverlay();
        
        // SMART RETAKE = EXAM MODE - enter fullscreen exam mode
        if (typeof App.enterFullExamMode === 'function') {
          App.enterFullExamMode();
        }
        state.isExamModeActive = true;
        state.appMode = App.APP_MODES?.EXAM_CONDUCTION || 'exam';
        
        App.switchScreen('exam');
        App.startTimer(state.config.duration);
        App.renderPalette();
        App.renderQuestion(0);
      } catch (error) {
        console.error('Weak retake error:', error);
        App.hideLoadingOverlay();
        App.showModal('Error', 'Failed to start practice. Please try again.', [
          { text: 'OK', primary: true, action: App.hideModal }
        ]);
      }
    }, 500);
  }

  function countAvailableWeakQuestions(sessionId, weakSubjects) {
    const session = App.Storage.getSessionById(sessionId);
    if (!session) return 0;
    
    const incorrectIds = App.Storage.getIncorrectQuestionIds(sessionId);
    const unansweredIds = App.Storage.getUnansweredQuestionIds(sessionId);
    const problemIds = [...new Set([...incorrectIds, ...unansweredIds])];
    
    const weakSubjectNames = weakSubjects.map(ws => ws.subject);
    let count = 0;
    
    App.appState.allQuestions.forEach(q => {
      if (weakSubjectNames.includes(q.subject)) {
        count++;
      }
    });
    
    return count;
  }

  function getAvailableQsForSubject(sessionId, subject) {
    return App.appState.allQuestions.filter(q => q.subject === subject).length;
  }

  function closeWeakAreasPanel() {
    const panel = document.getElementById('weak-areas-panel');
    if (panel) panel.style.display = 'none';
    
    const weakOption = document.querySelector('.retake-option[data-type="weak"]');
    if (weakOption) {
      weakOption.classList.remove('selected');
      weakOption.setAttribute('aria-selected', 'false');
    }
    
    const sameOption = document.querySelector('.retake-option[data-type="same"]');
    if (sameOption) {
      sameOption.classList.add('selected');
      sameOption.setAttribute('aria-selected', 'true');
    }
  }

  function validateWeakConfig() {
    const checkedSubjects = Array.from(document.querySelectorAll('#weak-areas-panel input[type="checkbox"]:checked'))
      .filter(cb => cb.id.startsWith('weak-'));
    
    let totalAvailable = 0;
    checkedSubjects.forEach(cb => {
      totalAvailable += parseInt(cb.dataset.available) || 0;
    });
    
    const requestedCount = parseInt(document.getElementById('weak-question-count')?.value) || 20;
    const allowFillNew = document.getElementById('allow-fill-new')?.checked;
    const msgEl = document.getElementById('weak-validation-msg');
    const startBtn = document.getElementById('start-weak-retake-btn');
    
    if (!msgEl) return;
    
    if (checkedSubjects.length === 0) {
      msgEl.style.display = 'block';
      msgEl.style.background = 'rgba(239, 68, 68, 0.1)';
      msgEl.style.color = 'var(--color-error)';
      msgEl.textContent = 'Please select at least one subject.';
      if (startBtn) startBtn.disabled = true;
    } else if (requestedCount > totalAvailable && !allowFillNew) {
      msgEl.style.display = 'block';
      msgEl.style.background = 'rgba(245, 158, 11, 0.1)';
      msgEl.style.color = 'var(--color-warning)';
      msgEl.textContent = `Only ${totalAvailable} questions available. Enable auto-fill or reduce count.`;
      if (startBtn) startBtn.disabled = false;
    } else if (requestedCount > totalAvailable && allowFillNew) {
      msgEl.style.display = 'block';
      msgEl.style.background = 'rgba(59, 130, 246, 0.1)';
      msgEl.style.color = '#3b82f6';
      msgEl.textContent = `${totalAvailable} weak questions + ${requestedCount - totalAvailable} new questions will be used.`;
      if (startBtn) startBtn.disabled = false;
    } else {
      msgEl.style.display = 'block';
      msgEl.style.background = 'rgba(34, 197, 94, 0.1)';
      msgEl.style.color = 'var(--color-success)';
      msgEl.textContent = `${requestedCount} questions ready from selected subjects.`;
      if (startBtn) startBtn.disabled = false;
    }
  }

  function executeWeakRetake(sessionId) {
    const selectedOption = document.querySelector('.retake-option[data-type="weak"]');
    if (selectedOption) {
      selectedOption.classList.add('selected');
    }
    executeRetake(sessionId);
  }

  function executeRetake(sessionId) {
    const selectedOption = document.querySelector('.retake-option.selected');
    if (!selectedOption) {
      alert('Please select a retake type');
      return;
    }

    const retakeType = selectedOption.dataset.type;
    const session = App.Storage.getSessionById(sessionId);
    
    App.hideModal();
    App.showLoadingOverlay('Preparing retake...');

    setTimeout(() => {
      try {
        let examQuestions = [];
        const state = App.appState;

        state.selectedBranch = session.branch;
        state.selectedExam = session.examType;
        state.examMode = session.mode;

        let questionsPool = state.allQuestions.filter(q => 
          (!session.branch || (q.branch && q.branch.trim() === session.branch)) &&
          (!session.examType || (q.examType && q.examType.trim() === session.examType))
        );

        switch (retakeType) {
          case 'same':
            examQuestions = getSameQuestions(session, questionsPool);
            break;
          case 'new':
            examQuestions = getNewQuestions(session, questionsPool);
            break;
          case 'improve':
            examQuestions = getImproveQuestions(session, questionsPool);
            break;
          case 'weak':
            examQuestions = getWeakQuestions(session, questionsPool);
            break;
        }

        if (examQuestions.length === 0) {
          App.hideLoadingOverlay();
          App.showModal('No Questions', 'Could not find enough questions for this retake configuration.', [
            { text: 'OK', primary: true, action: App.hideModal }
          ]);
          return;
        }

        state.examQuestions = App.prepareExamQuestions(examQuestions);
        state.userAnswers = state.examQuestions.map(() => ({
          selectedOption: null, 
          visited: false, 
          markedForReview: false
        }));
        state.currentQuestionIndex = 0;
        
        // FIX: Clear stale data from previous exam to ensure fresh calculation on submit
        state.evaluatedAnswers = [];
        state.results = {};
        
        state.config = session.config;
        state.config.duration = session.config.duration || 90;
        
        state.currentRetakeMetadata = {
          parentSessionId: sessionId,
          retakeType: retakeType
        };

        App.hideLoadingOverlay();
        
        // SMART RETAKE = EXAM MODE - enter fullscreen exam mode
        if (typeof App.enterFullExamMode === 'function') {
          App.enterFullExamMode();
        }
        state.isExamModeActive = true;
        state.appMode = App.APP_MODES?.EXAM_CONDUCTION || 'exam';
        
        App.switchScreen('exam');
        App.startTimer(state.config.duration);
        App.renderPalette();
        App.renderQuestion(0);
      } catch (error) {
        console.error('Retake error:', error);
        App.hideLoadingOverlay();
        App.showModal('Error', 'Failed to start retake. Please try again.', [
          { text: 'OK', primary: true, action: App.hideModal }
        ]);
      }
    }, 500);
  }

  function getSameQuestions(session, questionsPool) {
    const questionIds = session.questions.map(q => q.id);
    const sameQuestions = questionsPool.filter(q => questionIds.includes(q.id));
    return App.shuffleArray(sameQuestions);
  }

  function getNewQuestions(session, questionsPool) {
    const usedIds = session.questions.map(q => q.id);
    const targetCount = session.questions.length;
    
    let filteredPool = questionsPool;
    
    if (session.mode === 'subject' && session.config) {
      const subjects = session.config.subjects || session.config.selectedSubjects || [];
      
      if (subjects.length > 0) {
        filteredPool = filteredPool.filter(q => subjects.includes(q.subject));
      }
    } else if (session.mode === 'full' && session.config) {
      const techCount = session.config.techQuestions || 0;
      const nonTechCount = session.config.nonTechQuestions || 0;
      const difficulties = session.config.difficulties || ['Easy', 'Medium', 'Hard'];
      const types = session.config.types || ['Numerical', 'Theoretical', 'Conceptual'];
      
      const technicalSubjects = ['Electrical Machines', 'Power Systems', 'Control Systems', 'Power Electronics', 'Transformers', 'DC Machines', 'Induction Motors', 'Synchronous Machines', 'Network Analysis', 'Electromagnetic Fields'];
      
      let techQuestions = filteredPool.filter(q =>
        !usedIds.includes(q.id) &&
        technicalSubjects.some(subj => q.subject && q.subject.includes(subj)) &&
        difficulties.includes(q.difficulty) &&
        types.includes(q.type)
      );
      
      let nonTechQuestions = filteredPool.filter(q =>
        !usedIds.includes(q.id) &&
        !technicalSubjects.some(subj => q.subject && q.subject.includes(subj)) &&
        difficulties.includes(q.difficulty) &&
        types.includes(q.type)
      );
      
      techQuestions = App.shuffleArray(techQuestions).slice(0, techCount);
      nonTechQuestions = App.shuffleArray(nonTechQuestions).slice(0, nonTechCount);
      
      return App.shuffleArray([...techQuestions, ...nonTechQuestions]);
    }
    
    let available = filteredPool.filter(q => !usedIds.includes(q.id));
    
    if (available.length < targetCount) {
      available = filteredPool;
    }
    
    return App.shuffleArray(available).slice(0, targetCount);
  }

  function getImproveQuestions(session, questionsPool) {
    const incorrectIds = App.Storage.getIncorrectQuestionIds(session.id);
    const unansweredIds = App.Storage.getUnansweredQuestionIds(session.id);
    const weakIds = [...new Set([...incorrectIds, ...unansweredIds])];
    const usedIds = session.questions.map(q => q.id);
    const targetCount = session.questions.length;
    
    // FIX: Get the subjects from the original session for subject-wise mode
    const sessionSubjects = session.config?.subjects || session.config?.selectedSubjects || [];
    const isSubjectMode = session.mode === 'subject' && sessionSubjects.length > 0;
    
    // Filter questions pool by subjects if in subject mode
    let filteredPool = questionsPool;
    if (isSubjectMode) {
      filteredPool = questionsPool.filter(q => sessionSubjects.includes(q.subject));
    }
    
    let weakQuestions = filteredPool.filter(q => weakIds.includes(q.id));
    
    if (weakQuestions.length >= targetCount) {
      return App.shuffleArray(weakQuestions).slice(0, targetCount);
    }
    
    const neededNewCount = targetCount - weakQuestions.length;
    
    // FIX: New questions should also be from the same subjects
    let newQuestions = filteredPool.filter(q => !usedIds.includes(q.id));
    
    if (newQuestions.length < neededNewCount) {
      // If not enough new questions, allow questions that were used but not weak
      const moreQuestions = filteredPool.filter(q => !weakIds.includes(q.id));
      newQuestions = [...newQuestions, ...moreQuestions.filter(q => !newQuestions.some(nq => nq.id === q.id))];
    }
    
    const selectedNewQuestions = App.shuffleArray(newQuestions).slice(0, neededNewCount);
    const result = [...weakQuestions, ...selectedNewQuestions];
    
    return App.shuffleArray(result);
  }

  function getWeakQuestions(session, questionsPool) {
    const incorrectIds = App.Storage.getIncorrectQuestionIds(session.id);
    const unansweredIds = App.Storage.getUnansweredQuestionIds(session.id);
    const problemIds = [...new Set([...incorrectIds, ...unansweredIds])];
    
    const weakQuestions = questionsPool.filter(q => problemIds.includes(q.id));
    
    return App.shuffleArray(weakQuestions);
  }

  function showCustomExamBuilder(sessionId) {
    const session = App.Storage.getSessionById(sessionId);
    if (!session) return;
    
    const state = App.appState;
    let questionsPool = state.allQuestions.filter(q => 
      (!session.branch || (q.branch && q.branch.trim() === session.branch)) &&
      (!session.examType || (q.examType && q.examType.trim() === session.examType))
    );
    
    const allSubjects = [...new Set(questionsPool.map(q => q.subject).filter(Boolean))].sort();
    const subjectCounts = {};
    allSubjects.forEach(subj => {
      subjectCounts[subj] = questionsPool.filter(q => q.subject === subj).length;
    });
    
    let existingOverlay = document.getElementById('custom-exam-overlay');
    let existingPanel = document.getElementById('custom-exam-panel');
    if (existingOverlay) existingOverlay.remove();
    if (existingPanel) existingPanel.remove();
    
    const isLightMode = document.documentElement.getAttribute('data-theme') === 'light-purple';
    
    const themeStyles = isLightMode ? {
      overlayBg: 'rgba(0,0,0,0.4)',
      panelBg: 'linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%)',
      panelShadow: '-10px 0 40px rgba(124, 58, 237, 0.15)',
      headerBg: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, transparent 100%)',
      headerTitle: '#1e1b4b',
      headerSubtitle: '#6b7280',
      closeBtn: '#374151',
      sectionTitle: '#1e1b4b',
      subjectContainerBg: '#f3f4f6',
      subjectRowBorder: '#e5e7eb',
      subjectLabel: '#374151',
      subjectCountBg: 'rgba(124, 58, 237, 0.1)',
      subjectCountText: '#7c3aed',
      inputBg: '#ffffff',
      inputBorder: '#d1d5db',
      inputText: '#374151',
      footerBg: 'linear-gradient(0deg, rgba(124, 58, 237, 0.05) 0%, transparent 100%)',
      totalLabel: '#6b7280',
      selectedRowBg: 'rgba(124, 58, 237, 0.1)',
      primaryColor: '#7c3aed'
    } : {
      overlayBg: 'rgba(0,0,0,0.7)',
      panelBg: 'linear-gradient(180deg, #0a0a0a 0%, #111 100%)',
      panelShadow: '-10px 0 40px rgba(185, 28, 28, 0.2)',
      headerBg: 'linear-gradient(135deg, rgba(185, 28, 28, 0.2) 0%, transparent 100%)',
      headerTitle: 'var(--color-text)',
      headerSubtitle: 'var(--color-text-secondary)',
      closeBtn: 'var(--color-text)',
      sectionTitle: 'var(--color-text)',
      subjectContainerBg: 'rgba(0,0,0,0.3)',
      subjectRowBorder: 'var(--color-border)',
      subjectLabel: 'var(--color-text)',
      subjectCountBg: 'var(--color-secondary)',
      subjectCountText: 'var(--color-text-secondary)',
      inputBg: 'var(--color-surface)',
      inputBorder: 'var(--color-border)',
      inputText: 'var(--color-text)',
      footerBg: 'linear-gradient(0deg, rgba(185, 28, 28, 0.1) 0%, transparent 100%)',
      totalLabel: 'var(--color-text-secondary)',
      selectedRowBg: 'rgba(185, 28, 28, 0.1)',
      primaryColor: 'var(--color-primary)'
    };
    
    const overlay = document.createElement('div');
    overlay.id = 'custom-exam-overlay';
    overlay.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;background:${themeStyles.overlayBg};z-index:9998;opacity:0;transition:opacity 0.3s ease;`;
    overlay.onclick = closeCustomExamBuilder;
    
    const panel = document.createElement('div');
    panel.id = 'custom-exam-panel';
    panel.dataset.lightMode = isLightMode ? 'true' : 'false';
    panel.style.cssText = `
      position: fixed; top: 0; right: -450px; width: 450px; max-width: 95vw; height: 100vh;
      background: ${themeStyles.panelBg};
      border-left: 1px solid ${isLightMode ? '#e5e7eb' : 'var(--color-primary)'};
      z-index: 9999; transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex; flex-direction: column; box-shadow: ${themeStyles.panelShadow};
    `;
    
    panel.innerHTML = `
      <div style="padding: 20px 24px; background: ${themeStyles.headerBg}; border-bottom: 1px solid ${isLightMode ? '#e5e7eb' : 'var(--color-border)'}; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="margin: 0; font-size: 20px; font-weight: 700; color: ${themeStyles.headerTitle};">Custom Exam Builder</h3>
          <p style="margin: 4px 0 0; font-size: 12px; color: ${themeStyles.headerSubtitle};">Design your perfect practice session</p>
        </div>
        <button onclick="AssamiApp.closeCustomExamBuilder()" style="background: none; border: none; color: ${themeStyles.closeBtn}; font-size: 28px; cursor: pointer; padding: 0; line-height: 1;">&times;</button>
      </div>
      
      <div style="flex: 1; overflow-y: auto; padding: 20px 24px;">
        <div style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <span style="font-size: 18px;">📚</span>
            <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: ${themeStyles.sectionTitle};">Select Subjects</h4>
          </div>
          <div id="custom-subjects-container" style="max-height: 200px; overflow-y: auto; border: 1px solid ${isLightMode ? '#e5e7eb' : 'var(--color-border)'}; border-radius: 10px; background: ${themeStyles.subjectContainerBg};">
            ${allSubjects.map(subj => `
              <div class="custom-subject-row" data-subject="${subj}" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid ${themeStyles.subjectRowBorder}; transition: background 0.2s;">
                <input type="checkbox" id="subj-${subj.replace(/\s+/g, '-')}" style="width: 18px; height: 18px; accent-color: ${themeStyles.primaryColor}; cursor: pointer;">
                <label for="subj-${subj.replace(/\s+/g, '-')}" style="flex: 1; cursor: pointer; font-size: 13px; color: ${themeStyles.subjectLabel};">${subj}</label>
                <span style="font-size: 11px; color: ${themeStyles.subjectCountText}; background: ${themeStyles.subjectCountBg}; padding: 2px 8px; border-radius: 10px;">${subjectCounts[subj]} Qs</span>
                <input type="number" class="custom-subject-count" min="1" max="${subjectCounts[subj]}" value="5" style="width: 55px; padding: 6px 8px; border: 1px solid ${themeStyles.inputBorder}; border-radius: 6px; background: ${themeStyles.inputBg}; color: ${themeStyles.inputText}; font-size: 12px; text-align: center;" disabled>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <span style="font-size: 18px;">🎚️</span>
            <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: ${themeStyles.sectionTitle};">Difficulty Level</h4>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <label style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: ${isLightMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(6, 214, 160, 0.1)'}; border: 1px solid ${isLightMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(6, 214, 160, 0.3)'}; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
              <input type="checkbox" id="diff-easy" checked style="accent-color: ${isLightMode ? '#10b981' : '#06d6a0'};">
              <span style="color: ${isLightMode ? '#059669' : '#06d6a0'}; font-size: 13px; font-weight: 500;">Easy</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: ${isLightMode ? 'rgba(245, 158, 11, 0.1)' : 'rgba(244, 162, 97, 0.1)'}; border: 1px solid ${isLightMode ? 'rgba(245, 158, 11, 0.3)' : 'rgba(244, 162, 97, 0.3)'}; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
              <input type="checkbox" id="diff-medium" checked style="accent-color: ${isLightMode ? '#f59e0b' : '#f4a261'};">
              <span style="color: ${isLightMode ? '#d97706' : '#f4a261'}; font-size: 13px; font-weight: 500;">Medium</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: ${isLightMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 84, 89, 0.1)'}; border: 1px solid ${isLightMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 84, 89, 0.3)'}; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
              <input type="checkbox" id="diff-hard" checked style="accent-color: ${isLightMode ? '#ef4444' : '#ff5459'};">
              <span style="color: ${isLightMode ? '#dc2626' : '#ff5459'}; font-size: 13px; font-weight: 500;">Hard</span>
            </label>
          </div>
        </div>
        
        <div style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <span style="font-size: 18px;">📝</span>
            <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: ${themeStyles.sectionTitle};">Question Types</h4>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <label style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: ${isLightMode ? 'rgba(124, 58, 237, 0.08)' : 'rgba(185, 28, 28, 0.1)'}; border: 1px solid ${isLightMode ? 'rgba(124, 58, 237, 0.2)' : 'rgba(185, 28, 28, 0.3)'}; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
              <input type="checkbox" id="type-numerical" checked style="accent-color: ${themeStyles.primaryColor};">
              <span style="color: ${themeStyles.subjectLabel}; font-size: 13px;">Numerical</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: ${isLightMode ? 'rgba(124, 58, 237, 0.08)' : 'rgba(185, 28, 28, 0.1)'}; border: 1px solid ${isLightMode ? 'rgba(124, 58, 237, 0.2)' : 'rgba(185, 28, 28, 0.3)'}; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
              <input type="checkbox" id="type-theoretical" checked style="accent-color: ${themeStyles.primaryColor};">
              <span style="color: ${themeStyles.subjectLabel}; font-size: 13px;">Theoretical</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: ${isLightMode ? 'rgba(124, 58, 237, 0.08)' : 'rgba(185, 28, 28, 0.1)'}; border: 1px solid ${isLightMode ? 'rgba(124, 58, 237, 0.2)' : 'rgba(185, 28, 28, 0.3)'}; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
              <input type="checkbox" id="type-conceptual" checked style="accent-color: ${themeStyles.primaryColor};">
              <span style="color: ${themeStyles.subjectLabel}; font-size: 13px;">Conceptual</span>
            </label>
          </div>
        </div>
        
        <div style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <span style="font-size: 18px;">⏱️</span>
            <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: ${themeStyles.sectionTitle};">Duration (minutes)</h4>
          </div>
          <input type="number" id="custom-duration" min="5" max="180" value="${session.config?.duration || 90}" style="width: 100%; padding: 12px 16px; border: 1px solid ${themeStyles.inputBorder}; border-radius: 8px; background: ${themeStyles.inputBg}; color: ${themeStyles.inputText}; font-size: 14px;">
        </div>
      </div>
      
      <div style="padding: 20px 24px; background: ${themeStyles.footerBg}; border-top: 1px solid ${isLightMode ? '#e5e7eb' : 'var(--color-border)'};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <span style="font-size: 14px; color: ${themeStyles.totalLabel};">Total Questions:</span>
          <span id="custom-total-count" style="font-size: 24px; font-weight: 700; color: ${themeStyles.primaryColor};">0</span>
        </div>
        <button id="start-custom-exam-btn" onclick="AssamiApp.startCustomExam('${sessionId}')" disabled style="width: 100%; padding: 14px; background: ${isLightMode ? '#7c3aed' : 'var(--color-primary)'}; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; opacity: 0.5;">
          Start Custom Exam
        </button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      panel.style.right = '0';
    });
    
    setTimeout(() => {
      const panelIsLightMode = panel.dataset.lightMode === 'true';
      const selectedBg = panelIsLightMode ? 'rgba(124, 58, 237, 0.1)' : 'rgba(185, 28, 28, 0.1)';
      
      document.querySelectorAll('.custom-subject-row input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', function() {
          const row = this.closest('.custom-subject-row');
          const countInput = row.querySelector('.custom-subject-count');
          countInput.disabled = !this.checked;
          if (this.checked) {
            row.style.background = selectedBg;
          } else {
            row.style.background = 'transparent';
          }
          updateCustomTotal();
        });
      });
      
      document.querySelectorAll('.custom-subject-count').forEach(input => {
        input.addEventListener('input', updateCustomTotal);
      });
    }, 100);
  }
  
  function closeCustomExamBuilder() {
    const overlay = document.getElementById('custom-exam-overlay');
    const panel = document.getElementById('custom-exam-panel');
    
    if (overlay) overlay.style.opacity = '0';
    if (panel) panel.style.right = '-450px';
    
    setTimeout(() => {
      if (overlay) overlay.remove();
      if (panel) panel.remove();
    }, 300);
  }
  
  function updateCustomTotal() {
    let total = 0;
    document.querySelectorAll('.custom-subject-row').forEach(row => {
      const cb = row.querySelector('input[type="checkbox"]');
      const countInput = row.querySelector('.custom-subject-count');
      if (cb && cb.checked && countInput) {
        total += parseInt(countInput.value) || 0;
      }
    });
    
    const totalEl = document.getElementById('custom-total-count');
    const startBtn = document.getElementById('start-custom-exam-btn');
    
    if (totalEl) totalEl.textContent = total;
    if (startBtn) {
      startBtn.disabled = total === 0;
      startBtn.style.opacity = total === 0 ? '0.5' : '1';
    }
  }
  
  function startCustomExam(sessionId) {
    const session = App.Storage.getSessionById(sessionId);
    if (!session) return;
    
    const subjectQuestionCounts = {};
    let totalQuestions = 0;
    
    document.querySelectorAll('.custom-subject-row').forEach(row => {
      const cb = row.querySelector('input[type="checkbox"]');
      const countInput = row.querySelector('.custom-subject-count');
      const subject = row.dataset.subject;
      
      if (cb && cb.checked && countInput) {
        const count = parseInt(countInput.value) || 0;
        if (count > 0) {
          subjectQuestionCounts[subject] = count;
          totalQuestions += count;
        }
      }
    });
    
    if (totalQuestions === 0) {
      alert('Please select at least one subject with questions');
      return;
    }
    
    const difficulties = [];
    if (document.getElementById('diff-easy')?.checked) difficulties.push('Easy');
    if (document.getElementById('diff-medium')?.checked) difficulties.push('Medium');
    if (document.getElementById('diff-hard')?.checked) difficulties.push('Hard');
    
    const types = [];
    if (document.getElementById('type-numerical')?.checked) types.push('Numerical');
    if (document.getElementById('type-theoretical')?.checked) types.push('Theoretical');
    if (document.getElementById('type-conceptual')?.checked) types.push('Conceptual');
    
    const duration = parseInt(document.getElementById('custom-duration')?.value) || 90;
    
    if (difficulties.length === 0) {
      alert('Please select at least one difficulty level');
      return;
    }
    
    if (types.length === 0) {
      alert('Please select at least one question type');
      return;
    }
    
    closeCustomExamBuilder();
    App.showLoadingOverlay('Building your custom exam...');
    
    setTimeout(() => {
      try {
        const state = App.appState;
        state.selectedBranch = session.branch;
        state.selectedExam = session.examType;
        state.examMode = 'subject';
        
        let questionsPool = state.allQuestions.filter(q => 
          (!session.branch || (q.branch && q.branch.trim() === session.branch)) &&
          (!session.examType || (q.examType && q.examType.trim() === session.examType))
        );
        
        let examQuestions = [];
        
        for (const [subject, count] of Object.entries(subjectQuestionCounts)) {
          const subjectQuestions = questionsPool.filter(q => 
            q.subject === subject &&
            difficulties.includes(q.difficulty) &&
            types.includes(q.type)
          );
          const selected = App.shuffleArray(subjectQuestions).slice(0, count);
          examQuestions.push(...selected);
        }
        
        if (examQuestions.length === 0) {
          App.hideLoadingOverlay();
          App.showModal('No Questions', 'No questions match your criteria. Try adjusting the filters.', [
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
        
        state.evaluatedAnswers = [];
        state.results = {};
        
        state.config = {
          duration: duration,
          difficulties: difficulties,
          types: types,
          subjects: Object.keys(subjectQuestionCounts),
          subjectCounts: subjectQuestionCounts,
          totalQuestions: examQuestions.length
        };
        
        state.selectedSubjects = Object.keys(subjectQuestionCounts);
        
        state.currentRetakeMetadata = {
          parentSessionId: sessionId,
          retakeType: 'custom'
        };
        
        App.hideLoadingOverlay();
        
        if (typeof App.enterFullExamMode === 'function') {
          App.enterFullExamMode();
        }
        state.isExamModeActive = true;
        state.appMode = App.APP_MODES?.EXAM_CONDUCTION || 'exam';
        
        App.switchScreen('exam');
        App.startTimer(duration);
        App.renderPalette();
        App.renderQuestion(0);
      } catch (error) {
        console.error('Custom exam error:', error);
        App.hideLoadingOverlay();
        App.showModal('Error', 'Failed to create custom exam. Please try again.', [
          { text: 'OK', primary: true, action: App.hideModal }
        ]);
      }
    }, 500);
  }

  App.showRetakeModal = showRetakeModal;
  App.executeRetake = executeRetake;
  App.closeWeakAreasPanel = closeWeakAreasPanel;
  App.validateWeakConfig = validateWeakConfig;
  App.executeWeakRetake = executeWeakRetake;
  App.showWeakAreasPopup = showWeakAreasPopup;
  App.closeWeakAreasPopup = closeWeakAreasPopup;
  App.updateWeakPopupTotal = updateWeakPopupTotal;
  App.startWeakRetakeFromPopup = startWeakRetakeFromPopup;
  App.showCustomExamBuilder = showCustomExamBuilder;
  App.closeCustomExamBuilder = closeCustomExamBuilder;
  App.startCustomExam = startCustomExam;

  window.showRetakeModal = showRetakeModal;

})(window.AssamiApp);
