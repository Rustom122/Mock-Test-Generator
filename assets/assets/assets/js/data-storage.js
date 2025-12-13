window.AssamiApp = window.AssamiApp || {};

(function(App) {
  'use strict';

  const STORAGE_KEYS = {
    SESSIONS: 'assami_sessions',
    PATTERNS: 'assami_patterns',
    SETTINGS: 'assami_settings'
  };

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  function getSessions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error reading sessions:', e);
      return [];
    }
  }

  function saveSession(session) {
    try {
      const sessions = getSessions();
      session.id = session.id || generateId();
      session.createdAt = session.createdAt || new Date().toISOString();
      session.updatedAt = new Date().toISOString();
      
      const existingIndex = sessions.findIndex(s => s.id === session.id);
      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.unshift(session);
      }
      
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
      return session;
    } catch (e) {
      console.error('Error saving session:', e);
      return null;
    }
  }

  function getSessionById(id) {
    const sessions = getSessions();
    return sessions.find(s => s.id === id) || null;
  }

  function deleteSession(id) {
    try {
      const sessions = getSessions().filter(s => s.id !== id);
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
      return true;
    } catch (e) {
      console.error('Error deleting session:', e);
      return false;
    }
  }

  function getPatterns() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PATTERNS);
      return data ? JSON.parse(data) : getDefaultPatterns();
    } catch (e) {
      console.error('Error reading patterns:', e);
      return getDefaultPatterns();
    }
  }

  function getDefaultPatterns() {
    return [
      {
        id: 'nrl',
        name: 'NRL Pattern',
        isDefault: true,
        config: {
          totalQuestions: 60,
          techQuestions: 45,
          nonTechQuestions: 15,
          duration: 90,
          difficulties: ['Easy', 'Medium', 'Hard'],
          types: ['Numerical', 'Theoretical', 'Conceptual']
        }
      },
      {
        id: 'gate',
        name: 'GATE Pattern',
        isDefault: true,
        config: {
          totalQuestions: 65,
          techQuestions: 55,
          nonTechQuestions: 10,
          duration: 180,
          difficulties: ['Medium', 'Hard'],
          types: ['Numerical', 'Theoretical', 'Conceptual']
        }
      }
    ];
  }

  function savePattern(pattern) {
    try {
      const patterns = getPatterns();
      pattern.id = pattern.id || generateId();
      pattern.createdAt = pattern.createdAt || new Date().toISOString();
      pattern.isDefault = pattern.isDefault || false;
      
      const existingIndex = patterns.findIndex(p => p.id === pattern.id);
      if (existingIndex >= 0) {
        patterns[existingIndex] = pattern;
      } else {
        patterns.push(pattern);
      }
      
      localStorage.setItem(STORAGE_KEYS.PATTERNS, JSON.stringify(patterns));
      return pattern;
    } catch (e) {
      console.error('Error saving pattern:', e);
      return null;
    }
  }

  function deletePattern(id) {
    try {
      const patterns = getPatterns().filter(p => p.id !== id && !p.isDefault);
      localStorage.setItem(STORAGE_KEYS.PATTERNS, JSON.stringify(patterns));
      return true;
    } catch (e) {
      console.error('Error deleting pattern:', e);
      return false;
    }
  }

  function getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    } catch (e) {
      return false;
    }
  }

  function createSessionObject(config) {
    const state = App.appState;
    return {
      id: generateId(),
      title: config.title || 'Mock Test',
      mode: config.mode || state.examMode,
      branch: state.selectedBranch,
      examType: state.selectedExam,
      userName: state.userName || 'Student',
      createdAt: new Date().toISOString(),
      config: {
        techQuestions: config.techQuestions || 0,
        nonTechQuestions: config.nonTechQuestions || 0,
        totalQuestions: config.totalQuestions || state.examQuestions.length,
        duration: config.duration || state.config.duration,
        difficulties: config.difficulties || state.config.difficulties,
        types: config.types || state.config.types,
        subjects: config.subjects || state.selectedSubjects
      },
      questions: state.examQuestions.map((q, i) => ({
        id: q.id,
        subject: q.subject,
        difficulty: q.difficulty,
        type: q.type,
        correctAnswer: q.correctAnswer,
        userAnswer: state.userAnswers[i]?.selectedOption,
        markedForReview: state.userAnswers[i]?.markedForReview || false
      })),
      stats: null,
      retakeMetadata: config.retakeMetadata || null,
      parentSessionId: config.parentSessionId || null,
      retakeType: config.retakeType || null
    };
  }

  function calculateSessionStats(session) {
    let correct = 0, incorrect = 0, unanswered = 0, marked = 0;
    const subjectStats = {};

    session.questions.forEach(q => {
      if (!subjectStats[q.subject]) {
        subjectStats[q.subject] = { correct: 0, incorrect: 0, unanswered: 0, total: 0 };
      }
      subjectStats[q.subject].total++;

      if (q.userAnswer === null || q.userAnswer === undefined) {
        unanswered++;
        subjectStats[q.subject].unanswered++;
      } else if (q.userAnswer === q.correctAnswer) {
        correct++;
        subjectStats[q.subject].correct++;
      } else {
        incorrect++;
        subjectStats[q.subject].incorrect++;
      }
      if (q.markedForReview) marked++;
    });

    return {
      correct,
      incorrect,
      unanswered,
      marked,
      total: session.questions.length,
      percentage: ((correct / session.questions.length) * 100).toFixed(2),
      accuracy: session.questions.length - unanswered > 0 
        ? ((correct / (session.questions.length - unanswered)) * 100).toFixed(2) 
        : 0,
      subjectStats
    };
  }

  function getAttemptNumber(session) {
    const sessions = getSessions();
    
    const configSignature = generateConfigSignature(session);
    
    const sameConfigSessions = sessions.filter(s => generateConfigSignature(s) === configSignature);
    
    const sortedSessions = [...sameConfigSessions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    let count = 0;
    for (const s of sortedSessions) {
      count++;
      if (s.id === session.id) {
        return count;
      }
    }
    
    return sortedSessions.length + 1;
  }

  function generateConfigSignature(session) {
    const parts = [
      session.mode || 'full',
      session.branch || '',
      session.examType || '',
      session.config?.totalQuestions || 0,
      session.config?.techQuestions || 0,
      session.config?.nonTechQuestions || 0
    ];
    
    if (session.config?.subjectCounts) {
      const sortedSubjects = Object.keys(session.config.subjectCounts).sort();
      parts.push(sortedSubjects.map(s => `${s}:${session.config.subjectCounts[s]}`).join(','));
    }
    
    if (session.config?.subjects && session.config.subjects.length > 0) {
      parts.push(session.config.subjects.sort().join(','));
    }
    
    return parts.join('|');
  }

  function getSessionTypeLabel(session) {
    if (!session.retakeType) return 'Fresh';
    switch (session.retakeType) {
      case 'same': return 'Retake-Same';
      case 'new': return 'All-New';
      case 'improve': return 'Improve';
      case 'weak': return 'Weak Areas';
      default: return 'Fresh';
    }
  }

  function getWeakSubjects(sessionId) {
    const session = getSessionById(sessionId);
    if (!session || !session.stats) return [];

    const weak = [];
    for (const [subject, stats] of Object.entries(session.stats.subjectStats)) {
      const percentage = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
      if (percentage < 60) {
        weak.push({ subject, ...stats, percentage: percentage.toFixed(1) });
      }
    }
    return weak.sort((a, b) => a.percentage - b.percentage);
  }

  function getIncorrectQuestionIds(sessionId) {
    const session = getSessionById(sessionId);
    if (!session) return [];
    
    return session.questions
      .filter(q => q.userAnswer !== null && q.userAnswer !== q.correctAnswer)
      .map(q => q.id);
  }

  function getUnansweredQuestionIds(sessionId) {
    const session = getSessionById(sessionId);
    if (!session) return [];
    
    return session.questions
      .filter(q => q.userAnswer === null || q.userAnswer === undefined)
      .map(q => q.id);
  }

  App.Storage = {
    KEYS: STORAGE_KEYS,
    generateId,
    getSessions,
    saveSession,
    getSessionById,
    deleteSession,
    getPatterns,
    savePattern,
    deletePattern,
    getSettings,
    saveSettings,
    createSessionObject,
    calculateSessionStats,
    getAttemptNumber,
    getSessionTypeLabel,
    getWeakSubjects,
    getIncorrectQuestionIds,
    getUnansweredQuestionIds
  };

})(window.AssamiApp);
