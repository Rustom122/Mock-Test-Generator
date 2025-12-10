window.AssamiApp = window.AssamiApp || {};

(function(App) {
  'use strict';

  let currentSort = 'latest';
  let currentModeFilter = 'all';
  let currentTypeFilter = 'all';

  function renderPerformanceHub() {
    const container = document.getElementById('performance-content');
    if (!container) return;

    const sessions = App.Storage.getSessions();
    
    if (sessions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <h3>No Test History Yet</h3>
          <p>Complete your first mock test to see your performance analytics here.</p>
          <button class="btn" onclick="AssamiApp.navigateToTab('home')">Start a Test</button>
        </div>
      `;
      return;
    }

    let filteredSessions = [...sessions];

    if (currentModeFilter !== 'all') {
      filteredSessions = filteredSessions.filter(s => s.mode === currentModeFilter);
    }

    if (currentTypeFilter !== 'all') {
      if (currentTypeFilter === 'fresh') {
        filteredSessions = filteredSessions.filter(s => !s.retakeType);
      } else {
        filteredSessions = filteredSessions.filter(s => s.retakeType === currentTypeFilter);
      }
    }

    switch (currentSort) {
      case 'highest':
        filteredSessions.sort((a, b) => (parseFloat(b.stats?.percentage) || 0) - (parseFloat(a.stats?.percentage) || 0));
        break;
      case 'lowest':
        filteredSessions.sort((a, b) => (parseFloat(a.stats?.percentage) || 0) - (parseFloat(b.stats?.percentage) || 0));
        break;
      case 'latest':
      default:
        filteredSessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }

    const analytics = calculateOverallAnalytics(sessions);

    container.innerHTML = `
      <div class="performance-analytics">
        <div class="analytics-grid">
          <div class="analytics-card">
            <div class="analytics-value">${sessions.length}</div>
            <div class="analytics-label">Total Tests</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-value">${analytics.avgScore}%</div>
            <div class="analytics-label">Avg Score</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-value">${analytics.bestScore}%</div>
            <div class="analytics-label">Best Score</div>
          </div>
          <div class="analytics-card">
            <div class="analytics-value">${analytics.totalQuestions}</div>
            <div class="analytics-label">Questions Attempted</div>
          </div>
        </div>
      </div>

      <div class="performance-filters">
        <div class="filter-group">
          <label>Sort by:</label>
          <select id="sort-select" onchange="AssamiApp.updatePerformanceSort(this.value)">
            <option value="latest" ${currentSort === 'latest' ? 'selected' : ''}>Latest First</option>
            <option value="highest" ${currentSort === 'highest' ? 'selected' : ''}>Highest Score</option>
            <option value="lowest" ${currentSort === 'lowest' ? 'selected' : ''}>Lowest Score</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Mode:</label>
          <select id="mode-filter" onchange="AssamiApp.updateModeFilter(this.value)">
            <option value="all" ${currentModeFilter === 'all' ? 'selected' : ''}>All</option>
            <option value="full" ${currentModeFilter === 'full' ? 'selected' : ''}>Full Mock</option>
            <option value="subject" ${currentModeFilter === 'subject' ? 'selected' : ''}>Subject-wise</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Type:</label>
          <select id="type-filter" onchange="AssamiApp.updateTypeFilter(this.value)">
            <option value="all" ${currentTypeFilter === 'all' ? 'selected' : ''}>All</option>
            <option value="fresh" ${currentTypeFilter === 'fresh' ? 'selected' : ''}>Fresh</option>
            <option value="same" ${currentTypeFilter === 'same' ? 'selected' : ''}>Retake-Same</option>
            <option value="new" ${currentTypeFilter === 'new' ? 'selected' : ''}>All-New</option>
            <option value="improve" ${currentTypeFilter === 'improve' ? 'selected' : ''}>Improve</option>
            <option value="weak" ${currentTypeFilter === 'weak' ? 'selected' : ''}>Weak Areas</option>
          </select>
        </div>
      </div>

      <div class="sessions-list">
        ${filteredSessions.map(session => renderSessionCard(session)).join('')}
      </div>

      ${renderSubjectAnalytics(sessions)}
      ${renderDifficultyAnalytics(sessions)}
    `;
  }

  function renderSessionCard(session) {
    const stats = session.stats || { correct: 0, total: 0, percentage: 0 };
    const typeLabel = App.Storage.getSessionTypeLabel(session);
    const attemptNum = App.Storage.getAttemptNumber(session);
    const date = new Date(session.createdAt);
    const formattedDate = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const percentage = parseFloat(stats.percentage) || 0;
    let scoreClass = 'score-low';
    if (percentage >= 70) scoreClass = 'score-high';
    else if (percentage >= 50) scoreClass = 'score-medium';

    return `
      <div class="session-card" onclick="AssamiApp.viewSessionResults('${session.id}')">
        <div class="session-header">
          <div class="session-title">${session.title || 'Mock Test'}</div>
          <div class="session-badges">
            <span class="badge badge-mode">${session.mode === 'full' ? 'Full Mock' : 'Subject-wise'}</span>
            <span class="badge badge-type badge-${typeLabel.toLowerCase().replace(/\s+/g, '-')}">${typeLabel}</span>
          </div>
        </div>
        <div class="session-meta">
          <span>Attempt #${attemptNum}</span>
          <span>${formattedDate}</span>
          ${session.branch ? `<span>${session.branch}</span>` : ''}
        </div>
        <div class="session-score">
          <div class="score-bar">
            <div class="score-fill ${scoreClass}" style="width: ${percentage}%"></div>
          </div>
          <div class="score-text">
            <span class="score-value">${stats.correct}/${stats.total}</span>
            <span class="score-percent ${scoreClass}">${stats.percentage}%</span>
          </div>
        </div>
        <div class="session-actions">
          <button class="btn btn-small btn-secondary" onclick="event.stopPropagation(); AssamiApp.showRetakeModal('${session.id}')">Retake</button>
          <button class="btn btn-small" onclick="event.stopPropagation(); AssamiApp.viewSessionResults('${session.id}')">View Details</button>
        </div>
      </div>
    `;
  }

  function renderSubjectAnalytics(sessions) {
    const subjectData = {};
    
    sessions.forEach(session => {
      if (session.stats && session.stats.subjectStats) {
        for (const [subject, stats] of Object.entries(session.stats.subjectStats)) {
          if (!subjectData[subject]) {
            subjectData[subject] = { correct: 0, total: 0 };
          }
          subjectData[subject].correct += stats.correct;
          subjectData[subject].total += stats.total;
        }
      }
    });

    const subjects = Object.entries(subjectData)
      .map(([subject, data]) => ({
        subject,
        percentage: data.total > 0 ? ((data.correct / data.total) * 100).toFixed(1) : 0,
        ...data
      }))
      .sort((a, b) => a.percentage - b.percentage);

    if (subjects.length === 0) return '';

    return `
      <div class="analytics-section">
        <h3 class="section-title">Subject Performance</h3>
        <div class="subject-bars">
          ${subjects.slice(0, 10).map(s => `
            <div class="subject-bar-item">
              <div class="subject-name">${s.subject}</div>
              <div class="subject-bar">
                <div class="subject-fill ${parseFloat(s.percentage) < 50 ? 'weak' : parseFloat(s.percentage) < 70 ? 'medium' : 'strong'}" 
                     style="width: ${s.percentage}%"></div>
              </div>
              <div class="subject-score">${s.percentage}%</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderDifficultyAnalytics(sessions) {
    const difficultyData = { Easy: { correct: 0, total: 0 }, Medium: { correct: 0, total: 0 }, Hard: { correct: 0, total: 0 } };
    
    sessions.forEach(session => {
      session.questions?.forEach(q => {
        const diff = q.difficulty || 'Medium';
        if (difficultyData[diff]) {
          difficultyData[diff].total++;
          if (q.userAnswer === q.correctAnswer) {
            difficultyData[diff].correct++;
          }
        }
      });
    });

    return `
      <div class="analytics-section">
        <h3 class="section-title">Performance by Difficulty</h3>
        <div class="difficulty-grid">
          ${Object.entries(difficultyData).map(([diff, data]) => {
            const percentage = data.total > 0 ? ((data.correct / data.total) * 100).toFixed(1) : 0;
            return `
              <div class="difficulty-card difficulty-${diff.toLowerCase()}">
                <div class="difficulty-name">${diff}</div>
                <div class="difficulty-score">${percentage}%</div>
                <div class="difficulty-details">${data.correct}/${data.total} correct</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function calculateOverallAnalytics(sessions) {
    if (sessions.length === 0) {
      return { avgScore: 0, bestScore: 0, totalQuestions: 0 };
    }

    let totalPercentage = 0;
    let bestScore = 0;
    let totalQuestions = 0;

    sessions.forEach(session => {
      const percentage = parseFloat(session.stats?.percentage) || 0;
      totalPercentage += percentage;
      if (percentage > bestScore) bestScore = percentage;
      totalQuestions += session.questions?.length || 0;
    });

    return {
      avgScore: (totalPercentage / sessions.length).toFixed(1),
      bestScore: bestScore.toFixed(1),
      totalQuestions
    };
  }

  function viewSessionResults(sessionId) {
    const session = App.Storage.getSessionById(sessionId);
    if (!session) {
      App.showModal('Error', 'Session not found.', [
        { text: 'OK', primary: true, action: App.hideModal }
      ]);
      return;
    }

    const state = App.appState;
    
    state.examQuestions = session.questions.map(q => {
      const fullQ = state.allQuestions.find(fq => fq.id === q.id);
      return fullQ ? { ...fullQ, correctAnswer: q.correctAnswer } : q;
    });
    
    state.userAnswers = session.questions.map(q => ({
      selectedOption: q.userAnswer,
      visited: true,
      markedForReview: q.markedForReview
    }));
    
    state.results = session.stats;
    state.currentSessionId = sessionId;

    App.switchScreen('results');
    App.renderResults();
    
    const retakeBtn = document.getElementById('retake-btn');
    if (retakeBtn) {
      retakeBtn.onclick = () => App.showRetakeModal(sessionId);
    }

    setTimeout(() => {
      if (window.MathJax) {
        MathJax.typesetPromise([document.getElementById('results-screen')]).catch(err => console.error('MathJax:', err));
      }
    }, 100);
  }

  function updatePerformanceSort(value) {
    currentSort = value;
    renderPerformanceHub();
  }

  function updateModeFilter(value) {
    currentModeFilter = value;
    renderPerformanceHub();
  }

  function updateTypeFilter(value) {
    currentTypeFilter = value;
    renderPerformanceHub();
  }

  App.renderPerformanceHub = renderPerformanceHub;
  App.viewSessionResults = viewSessionResults;
  App.updatePerformanceSort = updatePerformanceSort;
  App.updateModeFilter = updateModeFilter;
  App.updateTypeFilter = updateTypeFilter;

  window.viewSessionResults = viewSessionResults;

})(window.AssamiApp);
