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

    App.showModal('Smart Retake', modalHTML, [
      { text: 'Cancel', primary: false, action: App.hideModal },
      { text: 'Start Retake', primary: true, action: () => executeRetake(sessionId) }
    ]);

    setTimeout(() => {
      document.querySelectorAll('.retake-option').forEach(opt => {
        opt.addEventListener('click', function() {
          document.querySelectorAll('.retake-option').forEach(o => {
            o.classList.remove('selected');
            o.setAttribute('aria-selected', 'false');
          });
          this.classList.add('selected');
          this.setAttribute('aria-selected', 'true');
          
          if (this.dataset.type === 'weak') {
            App.hideModal();
            showWeakAreasPopup(sessionId);
          }
        });
        
        opt.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.click();
          }
        });
      });
      
      const firstOption = document.querySelector('.retake-option[data-type="same"]');
      if (firstOption) {
        firstOption.classList.add('selected');
        firstOption.setAttribute('aria-selected', 'true');
      }
    }, 100);
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
    
    let weakQuestions = questionsPool.filter(q => weakIds.includes(q.id));
    
    if (weakQuestions.length >= targetCount) {
      return App.shuffleArray(weakQuestions).slice(0, targetCount);
    }
    
    const neededNewCount = targetCount - weakQuestions.length;
    
    let newQuestions = questionsPool.filter(q => !usedIds.includes(q.id));
    
    if (newQuestions.length < neededNewCount) {
      const moreQuestions = questionsPool.filter(q => !weakIds.includes(q.id));
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

  App.showRetakeModal = showRetakeModal;
  App.executeRetake = executeRetake;
  App.closeWeakAreasPanel = closeWeakAreasPanel;
  App.validateWeakConfig = validateWeakConfig;
  App.executeWeakRetake = executeWeakRetake;
  App.showWeakAreasPopup = showWeakAreasPopup;
  App.closeWeakAreasPopup = closeWeakAreasPopup;
  App.updateWeakPopupTotal = updateWeakPopupTotal;
  App.startWeakRetakeFromPopup = startWeakRetakeFromPopup;

  window.showRetakeModal = showRetakeModal;

})(window.AssamiApp);
