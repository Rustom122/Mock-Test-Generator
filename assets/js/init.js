window.AssamiApp = window.AssamiApp || {};

(function(App) {
  'use strict';

  async function initializeApp() {
    App.initTheme();
    App.initBurgerMenu();
    App.initDraggableThemeButton();

    try {
      App.showLoadingOverlay('Loading question bank...');
      App.appState.allQuestions = await App.fetchQuestions();
      App.populateSubjects();
      App.loadBranchesAndExams();
      App.hideLoadingOverlay();
    } catch (error) {
      App.hideLoadingOverlay();
      console.error('Error fetching questions:', error);
    }
  }

  function initStats() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(App.loadAndAnimateStats, 300));
    } else {
      setTimeout(App.loadAndAnimateStats, 300);
    }
  }

  window.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
  });

  initStats();
  App.initVisitorCounter();

})(window.AssamiApp);
