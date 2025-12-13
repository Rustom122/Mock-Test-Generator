window.AssamiApp = window.AssamiApp || {};

(function(App) {
  'use strict';

  const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTjJ_eWAoVK2SXvTMvN0BM4SHo60i-0WE6UKmu4rTao2sLynOMvoQ427mHd2u9YWGeNjOYncb2S3YAf/pub?output=csv';

  App.CSV_URL = CSV_URL;

  App.appState = {
    currentScreen: 'config',
    allQuestions: [],
    examQuestions: [],
    currentQuestionIndex: 0,
    userAnswers: [],
    timerInterval: null,
    config: {},
    results: {},
    examMode: 'full',
    selectedSubjects: [],
    selectedChapters: [],
    selectedTopics: [],
    isAutoSubmit: false,
    selectedBranch: null,
    selectedExam: null,
    branches: [],
    exams: [],
    resultsFilter: new Set(),
    sectionFilter: 'all',
    filteredQuestionIndices: []
  };

  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async function fetchQuestions() {
    const response = await fetch(CSV_URL);
    const csvText = await response.text();
    const parsed = Papa.parse(csvText, {header: true, skipEmptyLines: true});

    function findColumn(row, possibleNames, exactMatch = false) {
      for (let name of possibleNames) {
        if (row.hasOwnProperty(name) && row[name] !== undefined && row[name] !== null) {
          return row[name];
        }
      }
      const keys = Object.keys(row);
      for (let key of keys) {
        const normalizedKey = key.trim().toLowerCase();
        for (let name of possibleNames) {
          if (normalizedKey === name.toLowerCase()) return row[key];
        }
      }
      if (!exactMatch) {
        for (let key of keys) {
          const normalizedKey = key.trim().toLowerCase();
          for (let name of possibleNames) {
            if (normalizedKey.includes(name.toLowerCase())) return row[key];
          }
        }
      }
      return null;
    }

    if (parsed.data.length > 0) {
      console.log('CSV Column Headers:', Object.keys(parsed.data[0]));
      console.log('First row data:', parsed.data[0]);
    }

    return parsed.data.map((row, idx) => {
      const question = findColumn(row, ['Question', 'question', 'Q']);
      
      const optionA = findColumn(row, ['Option A', 'OptionA', 'option_a', 'Option_A'], true);
      const optionB = findColumn(row, ['Option B', 'OptionB', 'option_b', 'Option_B'], true);
      const optionC = findColumn(row, ['Option C', 'OptionC', 'option_c', 'Option_C'], true);
      const optionD = findColumn(row, ['Option D', 'OptionD', 'option_d', 'Option_D'], true);
      const correctStr = findColumn(row, ['Correct Answer', 'CorrectAnswer', 'Answer', 'correct_answer', 'Correct'], true);

      let correctIndex = 0;
      if (correctStr) {
        const cleaned = correctStr.toString().trim().toUpperCase();
        if (cleaned === 'A' || cleaned === '1') correctIndex = 0;
        else if (cleaned === 'B' || cleaned === '2') correctIndex = 1;
        else if (cleaned === 'C' || cleaned === '3') correctIndex = 2;
        else if (cleaned === 'D' || cleaned === '4') correctIndex = 3;
      }

      if (idx < 3) {
        console.log(`[Q${idx + 1}] Question: ${(question || '').substring(0, 50)}...`);
        console.log(`[Q${idx + 1}] Options: A="${optionA}", B="${optionB}", C="${optionC}", D="${optionD}"`);
        console.log(`[Q${idx + 1}] Correct Answer from CSV: "${correctStr}" -> Index: ${correctIndex}`);
        console.log(`[Q${idx + 1}] Correct Option Text: "${[optionA, optionB, optionC, optionD][correctIndex]}"`);
      }

      return {
        id: findColumn(row, ['ID', 'id', 'Id']) || idx + 1,
        question: question || '',
        options: [optionA || '', optionB || '', optionC || '', optionD || ''],
        correctAnswer: correctIndex,
        explanation: findColumn(row, ['Explanation', 'explanation', 'Explain']) || 'No explanation available.',
        subject: findColumn(row, ['Subject', 'subject']) || 'General',
        chapter: findColumn(row, ['Chapter', 'chapter']) || '',
        topic: findColumn(row, ['Topic', 'topic']) || '',
        difficulty: findColumn(row, ['Difficulty', 'difficulty', 'Level']) || 'Medium',
        type: findColumn(row, ['Type', 'type', 'Question Type', 'QuestionType', 'QuestionTyp']) || 'Theoretical',
        branch: findColumn(row, ['Branch', 'branch']) || '',
        examType: findColumn(row, ['Exam Type', 'ExamType', 'examType']) || ''
      };
    }).filter(q => q.question && q.question.trim() !== '');
  }

  function loadBranchesAndExams() {
    const allBranches = App.appState.allQuestions.map(q => q.branch).filter(Boolean).map(b => b.trim());
    const allExams = App.appState.allQuestions.map(q => q.examType).filter(Boolean).map(e => e.trim());

    App.appState.branches = [...new Set(allBranches)].sort();
    App.appState.exams = [...new Set(allExams)].sort();

    console.log('Extracted Branches:', App.appState.branches);
    console.log('Extracted Exams:', App.appState.exams);

    populateBranchesAndExams();
  }

  function populateBranchesAndExams() {
    const branchContainer = document.getElementById('branches-container');
    const examContainer = document.getElementById('exams-container');

    branchContainer.innerHTML = App.appState.branches.map(branch =>
      `<div class="capsule" data-branch="${branch}" onclick="AssamiApp.selectBranch(this, '${branch}')">${branch}</div>`
    ).join('');

    examContainer.innerHTML = App.appState.exams.map(exam =>
      `<div class="capsule" data-exam="${exam}" onclick="AssamiApp.selectExam(this, '${exam}')">${exam}</div>`
    ).join('');
  }

  function selectBranch(el, branch) {
    document.querySelectorAll('#branches-container .capsule').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    App.appState.selectedBranch = branch;
    localStorage.setItem('selectedBranch', branch);

    App.appState.selectedExam = null;
    localStorage.removeItem('selectedExam');
    document.querySelectorAll('#exams-container .capsule').forEach(c => c.classList.remove('selected'));

    updateExamsForBranch(branch);
    filterQuestionsByBranchAndExam();
  }

  function updateExamsForBranch(branch) {
    const branchQuestions = App.appState.allQuestions.filter(q => q.branch && q.branch.trim() === branch);

    const availableExams = [...new Set(
      branchQuestions.map(q => q.examType).filter(Boolean).map(e => e.trim())
    )].sort();

    console.log('Available exams for', branch, ':', availableExams);

    const examContainer = document.getElementById('exams-container');
    examContainer.innerHTML = availableExams.map(exam =>
      `<div class="capsule" data-exam="${exam}" onclick="AssamiApp.selectExam(this, '${exam}')">${exam}</div>`
    ).join('');
  }

  function selectExam(el, exam) {
    document.querySelectorAll('#exams-container .capsule').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    App.appState.selectedExam = exam;
    localStorage.setItem('selectedExam', exam);
    filterQuestionsByBranchAndExam();
  }

  function filterQuestionsByBranchAndExam() {
    let filtered = App.appState.allQuestions;
    if (App.appState.selectedBranch) {
      filtered = filtered.filter(q => q.branch && q.branch.trim() === App.appState.selectedBranch);
    }
    if (App.appState.selectedExam) {
      filtered = filtered.filter(q => q.examType && q.examType.trim() === App.appState.selectedExam);
    }
    App.appState.filteredQuestions = filtered;
    console.log('Filtered questions count:', filtered.length);
  }

  function populateSubjects() {
    let questionsToFilter = App.appState.allQuestions;

    if (App.appState.selectedBranch && App.appState.selectedExam) {
      questionsToFilter = App.appState.allQuestions.filter(q =>
        q.branch && q.branch.trim() === App.appState.selectedBranch &&
        q.examType && q.examType.trim() === App.appState.selectedExam
      );
    }

    const subjects = [...new Set(questionsToFilter.map(q => q.subject).filter(Boolean))];
    console.log('All subjects found:', subjects);
    console.log('Total questions:', questionsToFilter.length);

    const container = document.getElementById('subject-checkboxes');
    container.innerHTML = '';

    subjects.forEach((subj, idx) => {
      const div = document.createElement('div');
      div.className = 'checkbox-item';
      div.innerHTML = `
        <input type="checkbox" id="subj-${idx}" value="${subj}" onchange="AssamiApp.onSubjectChange()">
        <label for="subj-${idx}">${subj}</label>
      `;
      container.appendChild(div);
    });

    App.appState.filteredQuestions = questionsToFilter;
  }

  function onSubjectChange() {
    const checked = Array.from(document.querySelectorAll('#subject-checkboxes input:checked')).map(cb => cb.value);
    App.appState.selectedSubjects = checked;

    if (checked.length > 0) {
      populateChapters(checked);
      const chap = document.getElementById('chapter-selection');
      const top = document.getElementById('topic-selection');
      chap.style.display = 'block';
      chap.classList.add('collapsed');
      if (top) {top.style.display = 'block'; top.classList.add('collapsed');}
    } else {
      document.getElementById('chapter-selection').style.display = 'none';
      document.getElementById('topic-selection').style.display = 'none';
    }

    if (App.appState.countMode === 'custom') {
      updatePerSubjectCountsUI();
    }
  }

  function populateChapters(subjects) {
    const chapters = [...new Set(
      App.appState.allQuestions
        .filter(q => subjects.includes(q.subject))
        .map(q => q.chapter)
        .filter(Boolean)
    )];

    const container = document.getElementById('chapter-checkboxes');
    container.innerHTML = '';

    chapters.forEach((chap, idx) => {
      const div = document.createElement('div');
      div.className = 'checkbox-item';
      div.innerHTML = `
        <input type="checkbox" id="chap-${idx}" value="${chap}" checked onchange="AssamiApp.onChapterChange()">
        <label for="chap-${idx}">${chap}</label>
      `;
      container.appendChild(div);
    });

    onChapterChange();
  }

  function onChapterChange() {
    const checked = Array.from(document.querySelectorAll('#chapter-checkboxes input:checked')).map(cb => cb.value);
    App.appState.selectedChapters = checked;

    if (checked.length > 0) {
      populateTopics(App.appState.selectedSubjects, checked);
      document.getElementById('topic-selection').style.display = 'block';
    } else {
      document.getElementById('topic-selection').style.display = 'none';
    }
  }

  function populateTopics(subjects, chapters) {
    const topics = [...new Set(
      App.appState.allQuestions
        .filter(q => subjects.includes(q.subject) && chapters.includes(q.chapter))
        .map(q => q.topic)
        .filter(Boolean)
    )];

    const container = document.getElementById('topic-checkboxes');
    container.innerHTML = '';

    topics.forEach((topic, idx) => {
      const div = document.createElement('div');
      div.className = 'checkbox-item';
      div.innerHTML = `
        <input type="checkbox" id="topic-${idx}" value="${topic}" checked>
        <label for="topic-${idx}">${topic}</label>
      `;
      container.appendChild(div);
    });
  }

  function populateSubjectsForBranch() {
    if (!App.appState.selectedBranch) return;

    const branchQuestions = App.appState.allQuestions.filter(q =>
      q.branch && q.branch.trim() === App.appState.selectedBranch &&
      q.examType && q.examType.trim() === App.appState.selectedExam
    );

    const subjects = [...new Set(branchQuestions.map(q => q.subject).filter(Boolean))];

    const container = document.getElementById('subject-checkboxes');
    container.innerHTML = '';

    subjects.forEach((subj, idx) => {
      const div = document.createElement('div');
      div.className = 'checkbox-item';
      div.innerHTML = `
        <input type="checkbox" id="subj-${idx}" value="${subj}" onchange="AssamiApp.onSubjectChange()">
        <label for="subj-${idx}">${subj}</label>
      `;
      container.appendChild(div);
    });

    App.appState.filteredQuestions = branchQuestions;
  }

  function proceedToConfig() {
    const userName = document.getElementById('user-name-input').value.trim();

    if (!App.appState.selectedBranch) {
      App.showModal('Selection Required', 'Please select a branch to continue.', [
        {text: 'OK', primary: true, action: App.hideModal}
      ]);
      return;
    }

    if (!App.appState.selectedExam) {
      App.showModal('Selection Required', 'Please select an exam type to continue.', [
        {text: 'OK', primary: true, action: App.hideModal}
      ]);
      return;
    }

    App.appState.userName = userName || 'Student';
    localStorage.setItem('userName', App.appState.userName);

    const examNameInput = document.getElementById('exam-name');
    if (examNameInput && userName) {
      examNameInput.value = `${userName}'s Mock Test`;
    }

    const configContainer = document.querySelector('.config-container');
    let welcomeEl = document.getElementById('user-welcome-msg');
    if (!welcomeEl) {
      welcomeEl = document.createElement('div');
      welcomeEl.id = 'user-welcome-msg';
      welcomeEl.className = 'user-welcome';
      const subtitleEl = configContainer.querySelector('.config-subtitle');
      if (subtitleEl) {
        subtitleEl.after(welcomeEl);
      }
    }
    welcomeEl.innerHTML = `<span>Welcome, <strong>${App.appState.userName}</strong>! You selected <strong>${App.appState.selectedBranch}</strong> - <strong>${App.appState.selectedExam}</strong></span>`;

    App.closeBurgerMenu();
    App.switchScreen('config');

    populateSubjectsForBranch();
  }

  function filterQuestionsFullTest(questions, techCount, nonTechCount, difficulties, types) {
    const technicalSubjects = ['Electrical Machines', 'Power Systems', 'Control Systems', 'Power Electronics', 'Transformers', 'DC Machines', 'Induction Motors', 'Synchronous Machines', 'Network Analysis', 'Electromagnetic Fields'];

    const normalizedDifficulties = difficulties.map(d => (d || '').trim().toLowerCase());
    const normalizedTypes = types.map(t => (t || '').trim().toLowerCase());

    let techQuestions = questions.filter(q => {
      const qDiff = (q.difficulty || '').trim().toLowerCase();
      const qType = (q.type || '').trim().toLowerCase();
      return technicalSubjects.some(subj => q.subject && q.subject.includes(subj)) &&
        normalizedDifficulties.includes(qDiff) &&
        normalizedTypes.includes(qType);
    });

    let nonTechQuestions = questions.filter(q => {
      const qDiff = (q.difficulty || '').trim().toLowerCase();
      const qType = (q.type || '').trim().toLowerCase();
      return !technicalSubjects.some(subj => q.subject && q.subject.includes(subj)) &&
        normalizedDifficulties.includes(qDiff) &&
        normalizedTypes.includes(qType);
    });

    techQuestions = shuffleArray(techQuestions).slice(0, techCount);
    nonTechQuestions = shuffleArray(nonTechQuestions).slice(0, nonTechCount);

    return [...techQuestions, ...nonTechQuestions];
  }

  function filterQuestionsSubjectWise(questions, subjects, chapters, topics, count, types, difficulties) {
    const normalizedDifficulties = difficulties.map(d => (d || '').trim().toLowerCase());
    const normalizedTypes = types.map(t => (t || '').trim().toLowerCase());

    let filtered = questions.filter(q => {
      const qDiff = (q.difficulty || '').trim().toLowerCase();
      const qType = (q.type || '').trim().toLowerCase();
      return subjects.includes(q.subject) &&
        (chapters.length === 0 || chapters.includes(q.chapter)) &&
        (topics.length === 0 || topics.includes(q.topic)) &&
        normalizedDifficulties.includes(qDiff) &&
        normalizedTypes.includes(qType);
    });

    return shuffleArray(filtered).slice(0, count);
  }

  function prepareExamQuestions(questions) {
    return questions.map(q => {
      const optionsWithIndex = q.options.map((opt, idx) => ({text: opt, originalIndex: idx}));
      const shuffledOptions = shuffleArray(optionsWithIndex);
      const newCorrectIndex = shuffledOptions.findIndex(opt => opt.originalIndex === q.correctAnswer);
      return {
        ...q,
        options: shuffledOptions.map(opt => opt.text),
        correctAnswer: newCorrectIndex
      };
    });
  }

  function startExam() {
    // Enter fullscreen exam mode
    if (typeof App.enterFullExamMode === 'function') {
      App.enterFullExamMode();
    }

    const state = App.appState;

    if (state.examMode === 'full') {
      const techCount = parseInt(document.getElementById('tech-questions-full').value) || 45;
      const nonTechCount = parseInt(document.getElementById('nontech-questions-full').value) || 15;
      const duration = parseInt(document.getElementById('duration').value) || 90;

      const difficulties = Array.from(document.querySelectorAll('#difficulty-checkboxes input:checked')).map(cb => cb.value);
      const types = Array.from(document.querySelectorAll('#question-type-checkboxes input:checked')).map(cb => cb.value);

      if (difficulties.length === 0 || types.length === 0) {
        App.showModal('Configuration Error', 'Please select at least one difficulty level and question type.', [
          {text: 'OK', primary: true, action: App.hideModal}
        ]);
        return;
      }

      let questionsPool = state.allQuestions;
      if (state.selectedBranch) {
        questionsPool = questionsPool.filter(q => q.branch && q.branch.trim() === state.selectedBranch);
      }
      if (state.selectedExam) {
        questionsPool = questionsPool.filter(q => q.examType && q.examType.trim() === state.selectedExam);
      }

      const filtered = filterQuestionsFullTest(questionsPool, techCount, nonTechCount, difficulties, types);
      state.examQuestions = prepareExamQuestions(filtered);
      state.config = {techCount, nonTechCount, duration, difficulties, types};
      state.config.duration = duration;

    } else {
      const selectedTopics = Array.from(document.querySelectorAll('#topic-checkboxes input:checked')).map(cb => cb.value);
      state.selectedTopics = selectedTopics;

      const duration = parseInt(document.getElementById('subject-duration')?.value) || 60;

      const difficulties = Array.from(document.querySelectorAll('#subject-difficulty-checkboxes input:checked')).map(cb => cb.value);
      const types = Array.from(document.querySelectorAll('#subject-question-type-checkboxes input:checked')).map(cb => cb.value);

      if (state.selectedSubjects.length === 0) {
        App.showModal('Configuration Error', 'Please select at least one subject.', [
          {text: 'OK', primary: true, action: App.hideModal}
        ]);
        return;
      }

      let questionsPool = state.allQuestions;
      if (state.selectedBranch) {
        questionsPool = questionsPool.filter(q => q.branch && q.branch.trim() === state.selectedBranch);
      }
      if (state.selectedExam) {
        questionsPool = questionsPool.filter(q => q.examType && q.examType.trim() === state.selectedExam);
      }

      let filtered = [];
      const normalizedDiffs = difficulties.map(d => (d || '').trim().toLowerCase());
      const normalizedTypes = types.map(t => (t || '').trim().toLowerCase());
      
      if (state.countMode === 'custom') {
        state.selectedSubjects.forEach(subj => {
          const subjectCount = state.perSubjectCounts[subj] || 0;
          if (subjectCount > 0) {
            let subjectQuestions = questionsPool.filter(q => {
              const qDiff = (q.difficulty || '').trim().toLowerCase();
              const qType = (q.type || '').trim().toLowerCase();
              return q.subject === subj &&
                (state.selectedChapters.length === 0 || state.selectedChapters.includes(q.chapter)) &&
                (selectedTopics.length === 0 || selectedTopics.includes(q.topic)) &&
                normalizedDiffs.includes(qDiff) &&
                normalizedTypes.includes(qType);
            });
            filtered.push(...shuffleArray(subjectQuestions).slice(0, subjectCount));
          }
        });
      } else {
        const count = parseInt(document.getElementById('subject-questions')?.value) || 30;
        filtered = filterQuestionsSubjectWise(questionsPool, state.selectedSubjects, state.selectedChapters, selectedTopics, count, types || ['Numerical', 'Theoretical', 'Conceptual'], difficulties || ['Easy', 'Medium', 'Hard']);
      }
      
      state.examQuestions = prepareExamQuestions(filtered);
      state.config = {count: filtered.length, duration, difficulties, types, countMode: state.countMode, perSubjectCounts: state.perSubjectCounts};
      state.config.duration = duration;
    }

    if (state.examQuestions.length === 0) {
      App.showModal('No Questions Found', 'No questions match your criteria. Please adjust your settings.', [
        {text: 'OK', primary: true, action: App.hideModal}
      ]);
      return;
    }

    state.userAnswers = state.examQuestions.map(() => ({selectedOption: null, visited: false, markedForReview: false}));
    state.currentQuestionIndex = 0;
    state.sectionFilter = 'all';
    state.filteredQuestionIndices = state.examQuestions.map((_, i) => i);

    App.switchScreen('exam');
    startTimer(state.config.duration);
    renderPalette();
    renderQuestion(0);
    setTimeout(() => typesetMathJaxForExam(), 100);
  }

  function startTimer(durationMinutes) {
    let totalSeconds = durationMinutes * 60;
    const timerEl = document.getElementById('timer');

    function updateTimer() {
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      timerEl.classList.remove('warning', 'danger');
      if (totalSeconds <= 60) {
        timerEl.classList.add('danger');
      } else if (totalSeconds <= 300) {
        timerEl.classList.add('warning');
      }

      if (totalSeconds <= 0) {
        clearInterval(App.appState.timerInterval);
        App.appState.isAutoSubmit = true;
        submitTest();
      }

      totalSeconds--;
    }

    updateTimer();
    App.appState.timerInterval = setInterval(updateTimer, 1000);
  }

  function renderPalette() {
    const state = App.appState;
    const grid = document.getElementById('palette-grid');
    grid.innerHTML = '';

    state.examQuestions.forEach((q, i) => {
      const btn = document.createElement('button');
      btn.className = 'palette-btn';
      btn.textContent = i + 1;
      btn.onclick = () => navigateToQuestion(i);
      grid.appendChild(btn);
    });

    updatePalette();
    renderSectionToggle();
  }

  function renderSectionToggle() {
    const state = App.appState;
    const container = document.getElementById('section-toggle-container');
    if (!container) return;

    container.style.display = 'block';

    if (state.examMode === 'full') {
      const technicalSubjects = ['Electrical Machines', 'Power Systems', 'Control Systems', 'Power Electronics', 'Transformers', 'DC Machines', 'Induction Motors', 'Synchronous Machines', 'Network Analysis', 'Electromagnetic Fields'];

      let techCount = 0;
      let nonTechCount = 0;
      state.examQuestions.forEach(q => {
        const isTech = technicalSubjects.some(subj => q.subject && q.subject.includes(subj));
        if (isTech) techCount++;
        else nonTechCount++;
      });

      let html = '<div class="section-toggle-header">Filter by Section</div>';
      html += '<div class="section-toggle-buttons">';
      html += `<button class="section-toggle-btn" data-filter="all">All (${state.examQuestions.length})</button>`;
      html += `<button class="section-toggle-btn" data-filter="tech">Technical (${techCount})</button>`;
      html += `<button class="section-toggle-btn" data-filter="non-tech">Non-Tech (${nonTechCount})</button>`;
      html += '</div>';

      html += '<div class="section-counts">';
      html += `<span>Tech: ${techCount}</span>`;
      html += `<span>Non-Tech: ${nonTechCount}</span>`;
      html += '</div>';

      container.innerHTML = html;
      attachFilterListeners(container);
    } else {
      const subjectCounts = {};
      state.examQuestions.forEach(q => {
        const subj = q.subject || 'Unknown';
        subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
      });

      const subjects = Object.keys(subjectCounts).sort();
      const isCollapsed = container.classList.contains('filter-collapsed');

      let html = '<div class="section-toggle-header collapsible-filter-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">';
      html += '<span>Filter by Subject</span>';
      html += `<span class="filter-collapse-icon" style="font-size: 10px; transition: transform 0.2s;">${isCollapsed ? '▼' : '▲'}</span>`;
      html += '</div>';

      html += `<div class="subject-filter-content" style="display: ${isCollapsed ? 'none' : 'block'};">`;
      html += '<div class="section-toggle-buttons" style="flex-direction: column;">';
      html += `<button class="section-toggle-btn" data-filter="all" data-filter-index="-1" style="width: 100%; text-align: left;">All Subjects (${state.examQuestions.length})</button>`;

      subjects.forEach((subj, idx) => {
        const count = subjectCounts[subj];
        html += `<button class="section-toggle-btn" data-filter-index="${idx}" style="width: 100%; text-align: left;">${subj} (${count})</button>`;
      });

      html += '</div>';
      html += '</div>';

      container.innerHTML = html;

      const headerEl = container.querySelector('.collapsible-filter-header');
      if (headerEl) {
        headerEl.addEventListener('click', toggleSubjectFilters);
      }

      container.querySelectorAll('.section-toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const filterIndex = parseInt(this.getAttribute('data-filter-index'));
          const filter = filterIndex === -1 ? 'all' : subjects[filterIndex];
          filterBySection(filter, container);
        });
      });
    }

    updateFilterButtonStates(container);
  }

  function attachFilterListeners(container) {
    container.querySelectorAll('.section-toggle-btn[data-filter]').forEach(btn => {
      btn.addEventListener('click', function() {
        const filter = this.getAttribute('data-filter');
        filterBySection(filter, container);
      });
    });
  }

  function updateFilterButtonStates(container) {
    const state = App.appState;
    container.querySelectorAll('.section-toggle-btn').forEach(btn => {
      btn.classList.remove('active');
      const dataFilter = btn.getAttribute('data-filter');
      const filterIndex = btn.getAttribute('data-filter-index');
      
      if (dataFilter === state.sectionFilter) {
        btn.classList.add('active');
      } else if (filterIndex !== null) {
        const idx = parseInt(filterIndex);
        if (idx === -1 && state.sectionFilter === 'all') {
          btn.classList.add('active');
        } else if (idx >= 0) {
          const subjects = Object.keys(
            state.examQuestions.reduce((acc, q) => {
              const subj = q.subject || 'Unknown';
              acc[subj] = true;
              return acc;
            }, {})
          ).sort();
          if (subjects[idx] === state.sectionFilter) {
            btn.classList.add('active');
          }
        }
      }
    });
  }

  function toggleSubjectFilters() {
    const container = document.getElementById('section-toggle-container');
    if (!container) return;

    container.classList.toggle('filter-collapsed');
    const content = container.querySelector('.subject-filter-content');
    const icon = container.querySelector('.filter-collapse-icon');

    if (content) {
      if (container.classList.contains('filter-collapsed')) {
        content.style.display = 'none';
        if (icon) icon.textContent = '▼';
      } else {
        content.style.display = 'block';
        if (icon) icon.textContent = '▲';
      }
    }
  }

  function filterBySection(section, container) {
    App.appState.sectionFilter = section;

    const targetContainer = container || document.getElementById('section-toggle-container');
    if (targetContainer) {
      updateFilterButtonStates(targetContainer);
    }

    const technicalSubjects = ['Electrical Machines', 'Power Systems', 'Control Systems', 'Power Electronics', 'Transformers', 'DC Machines', 'Induction Motors', 'Synchronous Machines', 'Network Analysis', 'Electromagnetic Fields'];

    if (section === 'all') {
      App.appState.filteredQuestionIndices = App.appState.examQuestions.map((_, i) => i);
    } else if (section === 'tech') {
      App.appState.filteredQuestionIndices = App.appState.examQuestions
        .map((q, i) => {
          const isTech = technicalSubjects.some(subj => q.subject && q.subject.includes(subj));
          return isTech ? i : -1;
        })
        .filter(i => i !== -1);
    } else if (section === 'non-tech') {
      App.appState.filteredQuestionIndices = App.appState.examQuestions
        .map((q, i) => {
          const isTech = technicalSubjects.some(subj => q.subject && q.subject.includes(subj));
          return !isTech ? i : -1;
        })
        .filter(i => i !== -1);
    } else {
      App.appState.filteredQuestionIndices = App.appState.examQuestions
        .map((q, i) => q.subject === section ? i : -1)
        .filter(i => i !== -1);
    }

    updatePaletteVisibility();
  }

  function updatePaletteVisibility() {
    const buttons = document.querySelectorAll('#palette-grid .palette-btn');
    const state = App.appState;

    buttons.forEach((btn, i) => {
      if (state.sectionFilter === 'all' || state.filteredQuestionIndices.includes(i)) {
        btn.style.display = '';
      } else {
        btn.style.display = 'none';
      }
    });
  }

  function updatePalette() {
    const state = App.appState;
    const buttons = document.querySelectorAll('#palette-grid .palette-btn');

    buttons.forEach((btn, i) => {
      btn.classList.remove('answered', 'not-answered', 'marked', 'current');

      const ans = state.userAnswers[i];
      if (ans.markedForReview) {
        btn.classList.add('marked');
      } else if (ans.selectedOption !== null) {
        btn.classList.add('answered');
      } else if (ans.visited) {
        btn.classList.add('not-answered');
      }

      if (i === state.currentQuestionIndex) {
        btn.classList.add('current');
      }
    });
  }

  function renderQuestion(index) {
    const state = App.appState;
    const q = state.examQuestions[index];
    state.currentQuestionIndex = index;
    state.userAnswers[index].visited = true;

    document.getElementById('question-number').textContent = `Question ${index + 1} of ${state.examQuestions.length}`;
    document.getElementById('section-badge').textContent = q.subject;
    document.getElementById('question-text').innerHTML = q.question;

    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    q.options.forEach((opt, i) => {
      const div = document.createElement('div');
      div.className = 'mcq-option';
      const isChecked = state.userAnswers[index].selectedOption === i ? 'checked' : '';
      div.innerHTML = `
        <input type="radio" name="answer" id="opt-${i}" value="${i}" ${isChecked} onchange="AssamiApp.selectAnswer(${i})">
        <label for="opt-${i}"><strong>${['A', 'B', 'C', 'D'][i]}.</strong> <span>${opt}</span></label>
      `;
      optionsContainer.appendChild(div);
    });

    const markBtn = document.getElementById('mark-review-btn');
    if (markBtn) {
      markBtn.textContent = state.userAnswers[index].markedForReview ? 'Unmark Review' : 'Mark for Review';
    }

    updatePalette();
    typesetMathJax(document.getElementById('question-area'));
    
    // Typeset MathJax for newly rendered question
    setTimeout(() => {
      typesetMathJaxForExam();
    }, 50);
  }

  function typesetMathJax(container) {
    if (!container) return;
    
    let spinnerEl = container.querySelector('.mathjax-loading-spinner');
    if (!spinnerEl) {
      spinnerEl = document.createElement('div');
      spinnerEl.className = 'mathjax-loading-spinner';
      spinnerEl.innerHTML = '<div class="math-spinner"></div>';
      spinnerEl.style.cssText = 'display:none;position:absolute;top:10px;right:10px;z-index:100;';
    }
    
    const hasLatex = container.innerHTML.includes('\\(') || container.innerHTML.includes('\\[') || 
                     container.innerHTML.includes('$$') || container.innerHTML.includes('$');
    
    if (!hasLatex) return;
    
    if (!container.querySelector('.mathjax-loading-spinner')) {
      container.style.position = 'relative';
      container.appendChild(spinnerEl);
    }
    
    spinnerEl.style.display = 'none';
    
    const showSpinnerTimeout = setTimeout(() => {
      spinnerEl.style.display = 'block';
    }, 150);
    
    if (window.MathJax && MathJax.typesetPromise) {
      try {
        if (typeof MathJax.typesetClear === 'function') {
          MathJax.typesetClear([container]);
        }
      } catch (e) { /* ignore - MathJax may not be fully loaded */ }
      MathJax.typesetPromise([container])
        .then(() => {
          clearTimeout(showSpinnerTimeout);
          spinnerEl.style.display = 'none';
        })
        .catch(err => {
          clearTimeout(showSpinnerTimeout);
          spinnerEl.style.display = 'none';
          console.error('MathJax rendering error:', err);
        });
    }
  }

  function typesetMathJaxForExam() {
    if (window.MathJax && window.MathJax.typesetPromise) {
      try {
        const examScreen = document.getElementById('exam-screen');
        if (examScreen) {
          MathJax.typesetPromise([examScreen])
            .then(() => {
              console.log('MathJax rendered successfully in exam');
            })
            .catch(err => {
              console.warn('MathJax render warning:', err);
            });
        }
      } catch(e) {
        console.error('MathJax error:', e);
      }
    }
  }

  function selectAnswer(optionIndex) {
    App.appState.userAnswers[App.appState.currentQuestionIndex].selectedOption = optionIndex;
    updatePalette();
  }

  function navigateToQuestion(index) {
    if (index >= 0 && index < App.appState.examQuestions.length) {
      renderQuestion(index);
    }
    setTimeout(() => typesetMathJaxForExam(), 50);
  }

  function prevQuestion() {
    if (App.appState.currentQuestionIndex > 0) {
      renderQuestion(App.appState.currentQuestionIndex - 1);
    }
    setTimeout(() => typesetMathJaxForExam(), 50);
  }

  function nextQuestion() {
    if (App.appState.currentQuestionIndex < App.appState.examQuestions.length - 1) {
      renderQuestion(App.appState.currentQuestionIndex + 1);
    }
    setTimeout(() => typesetMathJaxForExam(), 50);
  }

  function toggleMarkForReview() {
    const state = App.appState;
    const current = state.userAnswers[state.currentQuestionIndex];
    current.markedForReview = !current.markedForReview;

    const markBtn = document.getElementById('mark-review-btn');
    if (markBtn) {
      markBtn.textContent = current.markedForReview ? 'Unmark Review' : 'Mark for Review';
    }

    updatePalette();
  }

  function clearResponse() {
    App.appState.userAnswers[App.appState.currentQuestionIndex].selectedOption = null;
    document.querySelectorAll('input[name="answer"]').forEach(input => input.checked = false);
    updatePalette();
  }

  function submitTest() {
    const state = App.appState;
    const answered = state.userAnswers.filter(a => a.selectedOption !== null).length;
    const unanswered = state.examQuestions.length - answered;
    const marked = state.userAnswers.filter(a => a.markedForReview).length;

    const summaryHTML = `
      <div class="modal-stats">
        <div class="modal-stat-row">
          <span class="modal-stat-label">Total Questions</span>
          <span class="modal-stat-value">${state.examQuestions.length}</span>
        </div>
        <div class="modal-stat-row">
          <span class="modal-stat-label">Answered</span>
          <span class="modal-stat-value answered">${answered}</span>
        </div>
        <div class="modal-stat-row">
          <span class="modal-stat-label">Unanswered</span>
          <span class="modal-stat-value not-answered">${unanswered}</span>
        </div>
        <div class="modal-stat-row">
          <span class="modal-stat-label">Marked for Review</span>
          <span class="modal-stat-value marked">${marked}</span>
        </div>
      </div>
      ${unanswered > 0 ? '<p style="color: var(--color-warning); font-weight: 500;">⚠️ You have unanswered questions. Are you sure you want to submit?</p>' : '<p style="color: var(--color-success);">✓ All questions answered. Ready to submit!</p>'}
    `;

    const buttons = [];

    if (!state.isAutoSubmit) {
      buttons.push({text: 'Cancel', primary: false, action: App.hideModal});
    }

    buttons.push({
      text: state.isAutoSubmit ? 'OK' : 'Submit Test', primary: true, action: () => {
        App.hideModal();
        clearInterval(state.timerInterval);
        App.calculateResults();
        
        const examName = document.getElementById('exam-name')?.value || 'Mock Test';
        const session = App.Storage.createSessionObject({
          title: examName,
          mode: state.examMode,
          techQuestions: state.config.techCount || 0,
          nonTechQuestions: state.config.nonTechCount || 0,
          duration: state.config.duration,
          difficulties: state.config.difficulties,
          types: state.config.types,
          subjects: state.selectedSubjects,
          parentSessionId: state.currentRetakeMetadata?.parentSessionId || null,
          retakeType: state.currentRetakeMetadata?.retakeType || null
        });
        
        session.stats = App.Storage.calculateSessionStats(session);
        App.Storage.saveSession(session);
        state.currentSessionId = session.id;
        state.currentRetakeMetadata = null;
        
        // Exit fullscreen exam mode when submitting
        if (typeof App.exitFullExamMode === 'function') {
          App.exitFullExamMode();
        }
        
        App.switchScreen('results');
        App.renderResults();
        setTimeout(() => {if (window.MathJax) MathJax.typesetPromise([document.getElementById('results-screen')]).catch(err => console.error('MathJax:', err));}, 100);
      }
    });

    App.showModal('Submit Test', summaryHTML, buttons);
  }

  function retakeTest() {
    const state = App.appState;
    state.currentQuestionIndex = 0;
    state.userAnswers = [];
    state.isAutoSubmit = false;

    const filtered = state.examMode === 'full'
      ? filterQuestionsFullTest(state.allQuestions, state.config.techCount || 45, state.config.nonTechCount || 15, ['Easy', 'Medium', 'Hard'], ['Numerical', 'Theoretical', 'Conceptual'])
      : filterQuestionsSubjectWise(state.allQuestions, state.selectedSubjects, state.selectedChapters, state.selectedTopics, state.examQuestions.length, ['Numerical', 'Theoretical', 'Conceptual'], ['Easy', 'Medium', 'Hard']);

    state.examQuestions = prepareExamQuestions(filtered);
    state.userAnswers = state.examQuestions.map(() => ({selectedOption: null, visited: false, markedForReview: false}));

    App.switchScreen('exam');
    startTimer(state.config.duration);
    renderPalette();
    renderQuestion(0);
  }

  function newTest() {
    const state = App.appState;
    state.currentQuestionIndex = 0;
    state.userAnswers = [];
    state.examQuestions = [];
    state.config = {};
    state.isAutoSubmit = false;
    state.results = {};
    state.currentSessionId = null;
    state.viewingFromPerformance = false;
    state.currentScreen = 'config';
    
    App.switchScreen('config');
    if (typeof App.navigateToTab === 'function') {
      App.navigateToTab('home');
    }
    if (typeof App.showExamConfigSection === 'function') {
      App.showExamConfigSection();
    }
  }

  App.shuffleArray = shuffleArray;
  App.fetchQuestions = fetchQuestions;
  App.loadBranchesAndExams = loadBranchesAndExams;
  App.populateBranchesAndExams = populateBranchesAndExams;
  App.selectBranch = selectBranch;
  App.selectExam = selectExam;
  App.filterQuestionsByBranchAndExam = filterQuestionsByBranchAndExam;
  App.populateSubjects = populateSubjects;
  App.onSubjectChange = onSubjectChange;
  App.populateChapters = populateChapters;
  App.onChapterChange = onChapterChange;
  App.populateTopics = populateTopics;
  App.populateSubjectsForBranch = populateSubjectsForBranch;
  App.proceedToConfig = proceedToConfig;
  App.filterQuestionsFullTest = filterQuestionsFullTest;
  App.filterQuestionsSubjectWise = filterQuestionsSubjectWise;
  App.prepareExamQuestions = prepareExamQuestions;
  App.startExam = startExam;
  App.startTimer = startTimer;
  App.renderPalette = renderPalette;
  App.renderSectionToggle = renderSectionToggle;
  App.toggleSubjectFilters = toggleSubjectFilters;
  App.filterBySection = filterBySection;
  App.updatePaletteVisibility = updatePaletteVisibility;
  App.updatePalette = updatePalette;
  App.renderQuestion = renderQuestion;
  App.typesetMathJax = typesetMathJax;
  App.typesetMathJaxForExam = typesetMathJaxForExam;
  App.selectAnswer = selectAnswer;
  App.navigateToQuestion = navigateToQuestion;
  App.prevQuestion = prevQuestion;
  App.nextQuestion = nextQuestion;
  App.toggleMarkForReview = toggleMarkForReview;
  App.clearResponse = clearResponse;
  App.submitTest = submitTest;
  App.retakeTest = retakeTest;
  App.newTest = newTest;

  function markForReview() {
    toggleMarkForReview();
    nextQuestion();
  }

  function saveAndNext() {
    nextQuestion();
  }

  function navigateQuestion(direction) {
    if (direction < 0) {
      prevQuestion();
    } else {
      nextQuestion();
    }
  }

  App.markForReview = markForReview;
  App.saveAndNext = saveAndNext;
  App.navigateQuestion = navigateQuestion;

  App.appState.countMode = 'single';
  App.appState.perSubjectCounts = {};

  function toggleCountMode(mode) {
    App.appState.countMode = mode;
    const singleContainer = document.getElementById('single-total-container');
    const perSubjectContainer = document.getElementById('per-subject-counts-container');
    
    if (mode === 'single') {
      if (singleContainer) singleContainer.style.display = 'block';
      if (perSubjectContainer) perSubjectContainer.classList.remove('active');
    } else {
      if (singleContainer) singleContainer.style.display = 'none';
      if (perSubjectContainer) perSubjectContainer.classList.add('active');
      updatePerSubjectCountsUI();
    }
  }

  function updatePerSubjectCountsUI() {
    const selectedSubjects = App.appState.selectedSubjects;
    const grid = document.getElementById('subject-per-count-grid');
    if (!grid) return;

    if (selectedSubjects.length === 0) {
      grid.innerHTML = '<p style="color: var(--color-text-secondary); font-style: italic;">Please select subjects first.</p>';
      return;
    }

    grid.innerHTML = selectedSubjects.map(subj => {
      const currentCount = App.appState.perSubjectCounts[subj] || 10;
      return `
        <div class="subject-count-item">
          <label>${subj}</label>
          <input type="number" min="0" value="${currentCount}" data-subject="${subj}" onchange="AssamiApp.updateSubjectCountTotal()">
        </div>
      `;
    }).join('');

    updateSubjectCountTotal();
  }

  function updateSubjectCountTotal() {
    const inputs = document.querySelectorAll('#subject-per-count-grid input[data-subject]');
    let total = 0;
    
    App.appState.perSubjectCounts = {};
    inputs.forEach(input => {
      const count = parseInt(input.value) || 0;
      const subject = input.dataset.subject;
      App.appState.perSubjectCounts[subject] = count;
      total += count;
    });

    const totalEl = document.getElementById('subject-total-allocated');
    if (totalEl) {
      totalEl.textContent = total;
      totalEl.classList.remove('valid', 'invalid');
      totalEl.classList.add(total > 0 ? 'valid' : 'invalid');
    }

    const validationEl = document.getElementById('subject-count-validation');
    if (validationEl) {
      if (total === 0) {
        validationEl.className = 'validation-message error';
        validationEl.textContent = 'Please allocate at least 1 question.';
      } else {
        validationEl.className = 'validation-message success';
        validationEl.textContent = `Total ${total} questions will be used.`;
      }
    }
  }

  App.toggleCountMode = toggleCountMode;
  App.updatePerSubjectCountsUI = updatePerSubjectCountsUI;
  App.updateSubjectCountTotal = updateSubjectCountTotal;

  window.proceedToConfig = proceedToConfig;
  window.startExam = startExam;
  window.prevQuestion = prevQuestion;
  window.nextQuestion = nextQuestion;
  window.toggleMarkForReview = toggleMarkForReview;
  window.clearResponse = clearResponse;
  window.submitTest = submitTest;
  window.retakeTest = retakeTest;
  window.newTest = newTest;
  window.markForReview = markForReview;
  window.saveAndNext = saveAndNext;
  window.navigateQuestion = navigateQuestion;
  window.filterBySection = filterBySection;
  window.selectAnswer = selectAnswer;

})(window.AssamiApp);
