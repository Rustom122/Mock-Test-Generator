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

    const modalHTML = `
      <div class="retake-modal-content">
        <p style="margin-bottom: 20px; color: var(--color-text-secondary);">Choose how you want to retake this test:</p>
        
        <div class="retake-options">
          <div class="retake-option" data-type="same">
            <div class="retake-option-header">
              <span class="retake-icon">🔄</span>
              <span class="retake-title">Same Questions (Shuffled)</span>
            </div>
            <p class="retake-desc">Same set of questions with options reordered</p>
          </div>
          
          <div class="retake-option" data-type="new">
            <div class="retake-option-header">
              <span class="retake-icon">✨</span>
              <span class="retake-title">All New Questions</span>
            </div>
            <p class="retake-desc">Fresh set of questions with same configuration</p>
          </div>
          
          <div class="retake-option" data-type="improve">
            <div class="retake-option-header">
              <span class="retake-icon">📈</span>
              <span class="retake-title">Improve Mode</span>
            </div>
            <p class="retake-desc">Focus on ${incorrectCount + unansweredCount} weak/unanswered questions + new ones</p>
          </div>
          
          <div class="retake-option" data-type="weak" ${weakSubjects.length === 0 ? 'style="opacity:0.5;pointer-events:none;"' : ''}>
            <div class="retake-option-header">
              <span class="retake-icon">🎯</span>
              <span class="retake-title">Weak Areas Only</span>
            </div>
            <p class="retake-desc">${weakSubjects.length > 0 ? `Practice ${weakSubjects.length} weak subjects` : 'No weak subjects identified'}</p>
          </div>
        </div>

        <div id="weak-subjects-config" style="display:none; margin-top:20px;">
          <label style="display:block; margin-bottom:10px; font-weight:500;">Select weak subjects to practice:</label>
          <div class="weak-subjects-list">
            ${weakSubjects.map(ws => `
              <div class="checkbox-item">
                <input type="checkbox" id="weak-${ws.subject.replace(/\s+/g, '-')}" value="${ws.subject}" checked>
                <label for="weak-${ws.subject.replace(/\s+/g, '-')}">${ws.subject} (${ws.percentage}%)</label>
              </div>
            `).join('')}
          </div>
          <div class="form-group" style="margin-top:15px;">
            <label>Number of Questions:</label>
            <input type="number" id="weak-question-count" value="20" min="5" max="100" style="width:100px;">
          </div>
        </div>
      </div>
    `;

    App.showModal('Smart Retake', modalHTML, [
      { text: 'Cancel', primary: false, action: App.hideModal },
      { text: 'Start Retake', primary: true, action: () => executeRetake(sessionId) }
    ]);

    setTimeout(() => {
      document.querySelectorAll('.retake-option').forEach(opt => {
        opt.addEventListener('click', function() {
          document.querySelectorAll('.retake-option').forEach(o => o.classList.remove('selected'));
          this.classList.add('selected');
          
          const weakConfig = document.getElementById('weak-subjects-config');
          if (this.dataset.type === 'weak') {
            weakConfig.style.display = 'block';
          } else {
            weakConfig.style.display = 'none';
          }
        });
      });
      
      const firstOption = document.querySelector('.retake-option[data-type="same"]');
      if (firstOption) firstOption.classList.add('selected');
    }, 100);
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
    return questionsPool.filter(q => questionIds.includes(q.id));
  }

  function getNewQuestions(session, questionsPool) {
    const usedIds = session.questions.map(q => q.id);
    let available = questionsPool.filter(q => !usedIds.includes(q.id));
    
    if (available.length < session.questions.length) {
      available = questionsPool;
    }
    
    return App.shuffleArray(available).slice(0, session.questions.length);
  }

  function getImproveQuestions(session, questionsPool) {
    const incorrectIds = App.Storage.getIncorrectQuestionIds(session.id);
    const unansweredIds = App.Storage.getUnansweredQuestionIds(session.id);
    const weakIds = [...new Set([...incorrectIds, ...unansweredIds])];
    
    const weakQuestions = questionsPool.filter(q => weakIds.includes(q.id));
    const targetCount = session.questions.length;
    const weakCount = Math.min(weakQuestions.length, Math.ceil(targetCount * 0.7));
    const newCount = targetCount - weakCount;
    
    const usedIds = session.questions.map(q => q.id);
    let newQuestions = questionsPool.filter(q => !usedIds.includes(q.id));
    if (newQuestions.length < newCount) {
      newQuestions = questionsPool.filter(q => !weakIds.includes(q.id));
    }
    
    const selected = [
      ...App.shuffleArray(weakQuestions).slice(0, weakCount),
      ...App.shuffleArray(newQuestions).slice(0, newCount)
    ];
    
    return App.shuffleArray(selected);
  }

  function getWeakQuestions(session, questionsPool) {
    const selectedSubjects = Array.from(
      document.querySelectorAll('#weak-subjects-config input:checked')
    ).map(cb => cb.value);
    
    const questionCount = parseInt(document.getElementById('weak-question-count')?.value) || 20;
    
    const incorrectIds = App.Storage.getIncorrectQuestionIds(session.id);
    const unansweredIds = App.Storage.getUnansweredQuestionIds(session.id);
    const problemIds = [...new Set([...incorrectIds, ...unansweredIds])];
    
    let weakQuestions = questionsPool.filter(q => 
      selectedSubjects.includes(q.subject) && problemIds.includes(q.id)
    );
    
    if (weakQuestions.length < questionCount) {
      const additionalQuestions = questionsPool.filter(q =>
        selectedSubjects.includes(q.subject) && !problemIds.includes(q.id)
      );
      weakQuestions = [...weakQuestions, ...App.shuffleArray(additionalQuestions)];
    }
    
    return App.shuffleArray(weakQuestions).slice(0, questionCount);
  }

  App.showRetakeModal = showRetakeModal;
  App.executeRetake = executeRetake;

  window.showRetakeModal = showRetakeModal;

})(window.AssamiApp);
