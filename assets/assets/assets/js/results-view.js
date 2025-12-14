window.AssamiApp = window.AssamiApp || {};

(function(App) {
  'use strict';

  function calculateResults() {
    const state = App.appState;
    
    // SKIP if evaluatedAnswers already loaded from session (historical data)
    if (state.evaluatedAnswers && state.evaluatedAnswers.length > 0 && state.results?.submitted) {
      return;
    }
    
    let correct = 0, incorrect = 0, unanswered = 0, marked = 0;
    
    // Store evaluated answers at calculation time for immutable results
    state.evaluatedAnswers = [];

    state.userAnswers.forEach((ans, i) => {
      const q = state.examQuestions[i];
      const selectedOption = ans.selectedOption;
      const selectedOptionId = (selectedOption !== null && q.optionIds) ? q.optionIds[selectedOption] : null;
      const correctOptionId = q.correctOptionId || null;
      
      // ID-based evaluation if available, otherwise index-based
      let isCorrect = false;
      if (selectedOption !== null) {
        if (selectedOptionId && correctOptionId) {
          isCorrect = selectedOptionId === correctOptionId;
        } else {
          isCorrect = selectedOption === q.correctAnswer;
        }
      }
      
      // Store evaluated result
      state.evaluatedAnswers.push({
        questionId: q.id,
        selectedOption: selectedOption,
        selectedOptionId: selectedOptionId,
        correctAnswer: q.correctAnswer,
        correctOptionId: correctOptionId,
        isCorrect: isCorrect,
        markedForReview: ans.markedForReview
      });
      
      if (selectedOption === null) unanswered++;
      else if (isCorrect) correct++;
      else incorrect++;
      if (ans.markedForReview) marked++;
    });

    state.results = {
      correct,
      incorrect,
      unanswered,
      marked,
      total: state.examQuestions.length,
      percentage: ((correct / state.examQuestions.length) * 100).toFixed(2),
      submitted: true
    };
  }

  function toggleResultsFilter(filterType) {
    const state = App.appState;
    if (state.resultsFilter.has(filterType)) {
      state.resultsFilter.delete(filterType);
      document.querySelector(`[data-filter="${filterType}"]`).classList.remove('active');
    } else {
      state.resultsFilter.add(filterType);
      document.querySelector(`[data-filter="${filterType}"]`).classList.add('active');
    }
    filterAndDisplayResults();
  }

  function filterAndDisplayResults() {
    const state = App.appState;
    const reviewContainer = document.getElementById('questions-review');
    if (!reviewContainer) return;
    reviewContainer.innerHTML = '';

    state.examQuestions.forEach((q, i) => {
      const ans = state.userAnswers[i] || {};
      const evalResult = state.evaluatedAnswers?.[i];
      
      // PURE RENDERER: Use stored evaluation, never recompute
      let isCorrect = false;
      let isUnanswered = true;
      const selectedOption = ans.selectedOption;
      
      if (evalResult) {
        isCorrect = evalResult.isCorrect;
        isUnanswered = selectedOption === null;
      } else if (q.isCorrect !== undefined) {
        // Loaded from session
        isCorrect = q.isCorrect;
        isUnanswered = q.userAnswer === null || q.userAnswer === undefined;
      } else {
        // Fallback for live exam
        if (selectedOption !== null) {
          isUnanswered = false;
          const selectedOptionId = q.optionIds ? q.optionIds[selectedOption] : null;
          const correctOptionId = q.correctOptionId || null;
          if (selectedOptionId && correctOptionId) {
            isCorrect = selectedOptionId === correctOptionId;
          } else {
            isCorrect = selectedOption === q.correctAnswer;
          }
        }
      }
      
      const isMarked = ans.markedForReview || q.markedForReview;

      let questionType = isUnanswered ? 'unanswered' : (isCorrect ? 'correct' : 'incorrect');
      if (isMarked) questionType = 'marked';

      if (state.resultsFilter.size > 0 && !state.resultsFilter.has(questionType)) return;

      const div = document.createElement('div');
      div.className = `question-review ${isCorrect ? 'correct' : 'incorrect'}`;
      let html = `<div class="review-header"><span><strong>Q${i + 1}.</strong> <span class="badge">ID: ${q.id}</span> <span class="badge">${q.subject}</span> <span class="badge">${q.difficulty}</span></span></div>`;
      html += `<div class="question-text">${q.question}</div><div style="margin-top: 16px;">`;
      
      const userSelection = selectedOption !== null ? selectedOption : (q.userAnswer !== null ? q.userAnswer : null);
      
      q.options.forEach((opt, j) => {
        const isUser = userSelection === j;
        const isCorrectOpt = j === q.correctAnswer;
        let className = 'option-review';
        if (isUser) className += ' user-answer';
        if (isCorrectOpt) className += ' correct-answer';
        html += `<div class="${className}"><strong>${['A', 'B', 'C', 'D'][j]}.</strong> ${opt} ${isUser ? '<span class="badge">Your Answer</span>' : ''} ${isCorrectOpt ? '<span class="badge success">Correct</span>' : ''}</div>`;
      });
      html += `</div><div class="explanation"><strong>Explanation:</strong> <span class="explanation-text">${q.explanation}</span></div>`;
      div.innerHTML = html;
      reviewContainer.appendChild(div);
    });

    if (window.MathJax) {
      MathJax.typesetPromise([reviewContainer]).catch(err => console.error('MathJax explanation rendering:', err));
    }
  }

  function renderResults() {
    const r = App.appState.results;
    document.getElementById('score-display').textContent = `${r.correct}/${r.total}`;
    document.getElementById('percentage-display').textContent = `${r.percentage}%`;
    document.getElementById('correct-count').textContent = r.correct;
    document.getElementById('incorrect-count').textContent = r.incorrect;
    document.getElementById('unanswered-count').textContent = r.unanswered;
    document.getElementById('marked-count').textContent = r.marked;

    App.appState.resultsFilter.clear();
    document.querySelectorAll('.stat-toggle').forEach(el => el.classList.remove('active'));
    filterAndDisplayResults();
  }

  function exportToPDF() {
    const {jsPDF} = window.jspdf;
    const doc = new jsPDF();

    const brandRed = [185, 28, 28];
    const darkRed = [153, 27, 27];
    const lightRed = [220, 38, 38];

    function stripLatex(text) {
      if (!text) return '';
      text = text.replace(/\$\$(.*?)\$\$/g, '$1').replace(/\$(.*?)\$/g, '$1');
      text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)');
      text = text.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
      text = text.replace(/([A-Za-z])_\{([^}]+)\}/g, (match, base, sub) => base + convertToSubscript(sub));
      text = text.replace(/([A-Za-z])_([A-Za-z0-9])/g, (match, base, sub) => base + convertToSubscript(sub));
      text = text.replace(/\^(\{([^}]+)\}|([0-9]+))/g, (match, full, braced, simple) => convertToSuperscript(braced || simple));
      text = text.replace(/\\phi/g, 'φ').replace(/\\Phi/g, 'Φ');
      text = text.replace(/\\theta/g, 'θ').replace(/\\Theta/g, 'Θ');
      text = text.replace(/\\omega/g, 'ω').replace(/\\Omega/g, 'Ω');
      text = text.replace(/\\alpha/g, 'α').replace(/\\Alpha/g, 'Α');
      text = text.replace(/\\beta/g, 'β').replace(/\\Beta/g, 'Β');
      text = text.replace(/\\gamma/g, 'γ').replace(/\\Gamma/g, 'Γ');
      text = text.replace(/\\delta/g, 'δ').replace(/\\Delta/g, 'Δ');
      text = text.replace(/\\pi/g, 'π').replace(/\\Pi/g, 'Π');
      text = text.replace(/\\sigma/g, 'σ').replace(/\\Sigma/g, 'Σ');
      text = text.replace(/\\mu/g, 'μ').replace(/\\eta/g, 'η');
      text = text.replace(/\\lambda/g, 'λ').replace(/\\Lambda/g, 'Λ');
      text = text.replace(/\\rho/g, 'ρ').replace(/\\tau/g, 'τ');
      text = text.replace(/\\sum/g, '∑').replace(/\\prod/g, '∏');
      text = text.replace(/\\times/g, '×').replace(/\\cdot/g, '·');
      text = text.replace(/\\pm/g, '±').replace(/\\mp/g, '∓');
      text = text.replace(/\\div/g, '÷').replace(/\\neq/g, '≠');
      text = text.replace(/\\leq/g, '≤').replace(/\\geq/g, '≥');
      text = text.replace(/\\approx/g, '≈').replace(/\\infty/g, '∞');
      text = text.replace(/\\rightarrow/g, '→').replace(/\\leftarrow/g, '←');
      text = text.replace(/\\degree/g, '°').replace(/\\circ/g, '°');
      text = text.replace(/\\_/g, '_');
      text = text.replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '');
      return text.trim();
    }

    function convertToSubscript(str) {
      const subMap = {
        '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
        'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ', 'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ', 'x': 'ₓ',
        '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎'
      };
      return str.split('').map(c => subMap[c] || c).join('');
    }

    function convertToSuperscript(str) {
      const supMap = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        'a': 'ᵃ', 'b': 'ᵇ', 'c': 'ᶜ', 'd': 'ᵈ', 'e': 'ᵉ', 'f': 'ᶠ', 'g': 'ᵍ', 'h': 'ʰ', 'i': 'ⁱ', 'j': 'ʲ', 'k': 'ᵏ', 'l': 'ˡ', 'm': 'ᵐ', 'n': 'ⁿ', 'o': 'ᵒ', 'p': 'ᵖ', 'r': 'ʳ', 's': 'ˢ', 't': 'ᵗ', 'u': 'ᵘ', 'v': 'ᵛ', 'w': 'ʷ', 'x': 'ˣ', 'y': 'ʸ', 'z': 'ᶻ',
        '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾'
      };
      return str.split('').map(c => supMap[c] || c).join('');
    }

    let yPos = 15;

    doc.setDrawColor(...brandRed);
    doc.setLineWidth(2);
    doc.line(10, 10, 200, 10);

    const logoX = 70;
    const logoY = 14;
    const logoW = 70;
    const logoH = 25;

    doc.setDrawColor(...brandRed);
    doc.setLineWidth(1);
    doc.rect(logoX, logoY, logoW, logoH);

    doc.setLineWidth(0.5);
    doc.rect(logoX + 2, logoY + 2, logoW - 4, logoH - 4);

    doc.setFillColor(...brandRed);
    doc.rect(logoX + 4, logoY + 4, 4, logoH - 8, 'F');
    doc.rect(logoX + logoW - 8, logoY + 4, 4, logoH - 8, 'F');

    doc.rect(logoX + 4, logoY + 4, logoW - 8, 3, 'F');
    doc.rect(logoX + 4, logoY + logoH - 7, logoW - 8, 3, 'F');

    const centerX = logoX + logoW / 2;
    doc.setFillColor(...brandRed);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 5; col++) {
        const cx = logoX + 14 + col * 10;
        const cy = logoY + 10 + row * 8;
        doc.circle(cx, cy, 1.2, 'F');
      }
    }

    const leftDiamondX = logoX + 8;
    const rightDiamondX = logoX + logoW - 8;
    [logoY + 9, logoY + 16].forEach(dy => {
      doc.circle(leftDiamondX, dy, 0.6, 'F');
      doc.circle(rightDiamondX, dy, 0.6, 'F');
    });

    yPos = logoY + logoH + 8;

    doc.setTextColor(...brandRed);
    doc.setFontSize(28);
    doc.setFont(undefined, 'bold');
    doc.text('Assami', 105, yPos, {align: 'center'});
    yPos += 10;

    doc.setFontSize(12);
    doc.setTextColor(...darkRed);
    doc.text('Mock Test Results', 105, yPos, {align: 'center'});
    yPos += 12;

    doc.setLineWidth(0.5);
    doc.line(60, yPos, 150, yPos);
    yPos += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`Score: ${App.appState.results.correct}/${App.appState.results.total}`, 105, yPos, {align: 'center'});
    yPos += 8;

    doc.setTextColor(...brandRed);
    doc.setFontSize(20);
    doc.text(`${App.appState.results.percentage}%`, 105, yPos, {align: 'center'});
    yPos += 15;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(20, yPos, 190, yPos);
    yPos += 10;

    doc.setTextColor(0, 0, 0);
    App.appState.examQuestions.forEach((q, i) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
        doc.setDrawColor(...brandRed);
        doc.setLineWidth(1);
        doc.line(10, 10, 200, 10);
        doc.setTextColor(...brandRed);
        doc.setFontSize(10);
        doc.text('Assami - Mock Test Results', 105, 16, {align: 'center'});
        yPos = 25;
      }
      const ans = App.appState.userAnswers[i];
      const isCorrect = ans.selectedOption === q.correctAnswer;

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...brandRed);
      doc.text(`Q${i + 1}.`, 20, yPos);
      doc.setTextColor(100, 100, 100);
      doc.setFont(undefined, 'normal');
      doc.text(`[${q.difficulty}]`, 32, yPos);
      yPos += 7;

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      const qText = stripLatex(q.question);
      const qLines = doc.splitTextToSize(qText, 170);
      doc.text(qLines, 20, yPos);
      yPos += qLines.length * 5 + 3;

      doc.setFontSize(9);
      q.options.forEach((opt, j) => {
        const letter = ['A', 'B', 'C', 'D'][j];
        const isUser = ans.selectedOption === j;
        const isCorrectOpt = j === q.correctAnswer;

        if (isUser) doc.setFont(undefined, 'bold');
        if (isCorrectOpt) doc.setTextColor(0, 128, 0);
        else if (isUser && !isCorrect) doc.setTextColor(...lightRed);

        const optText = stripLatex(opt);
        const optLines = doc.splitTextToSize(`${letter}. ${optText}`, 165);
        doc.text(optLines, 25, yPos);
        yPos += optLines.length * 4 + 2;

        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
      });

      yPos += 2;
      if (isCorrect) {
        doc.setTextColor(0, 128, 0);
        doc.text('✓ Correct', 25, yPos);
      } else {
        doc.setTextColor(...lightRed);
        doc.text(`✗ Incorrect (Correct: ${['A', 'B', 'C', 'D'][q.correctAnswer]})`, 25, yPos);
      }
      doc.setTextColor(0, 0, 0);
      yPos += 6;

      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      const expText = stripLatex(q.explanation);
      const expLines = doc.splitTextToSize(`Explanation: ${expText}`, 165);
      doc.text(expLines, 25, yPos);
      yPos += expLines.length * 4 + 8;
    });

    const pageCount = doc.internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Assami Mock Test - Page ${i} of ${pageCount}`, 105, 290, {align: 'center'});
    }

    doc.save(`Assami_Mock_Test_Results_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  function animateNumber(elementId, target, suffix) {
    suffix = suffix || '';
    const el = document.getElementById(elementId);
    if (!el) {
      console.log('Element not found:', elementId);
      return;
    }

    const duration = 2000;
    const startTime = performance.now();
    const startValue = 0;

    function easeOutQuart(t) {
      return 1 - Math.pow(1 - t, 4);
    }

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutQuart(progress);
      const current = Math.floor(startValue + (target - startValue) * eased);

      el.textContent = current + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target + suffix;
      }
    }

    requestAnimationFrame(update);
  }

  async function loadAndAnimateStats() {
    const questionsEl = document.getElementById('stat-questions');
    const branchesEl = document.getElementById('stat-branches');
    const examsEl = document.getElementById('stat-exams');

    if (!questionsEl || !branchesEl || !examsEl) {
      console.log('Stats elements not found, retrying...');
      setTimeout(loadAndAnimateStats, 200);
      return;
    }

    try {
      const response = await fetch(App.CSV_URL);
      const csvText = await response.text();
      const parsed = Papa.parse(csvText, {header: true, skipEmptyLines: true});

      const questions = parsed.data.length;
      const branches = new Set();
      const exams = new Set();

      parsed.data.forEach(row => {
        if (row.Branch && row.Branch.trim()) branches.add(row.Branch.trim());
        if (row['Exam Type'] && row['Exam Type'].trim()) exams.add(row['Exam Type'].trim());
        if (row['ExamType'] && row['ExamType'].trim()) exams.add(row['ExamType'].trim());
      });

      console.log('Stats loaded:', questions, branches.size, exams.size);

      questionsEl.textContent = '0+';
      branchesEl.textContent = '0';
      examsEl.textContent = '0';

      setTimeout(() => {
        animateNumber('stat-questions', questions, '+');
        animateNumber('stat-branches', branches.size, '');
        animateNumber('stat-exams', exams.size, '');
      }, 100);

    } catch (error) {
      console.log('Loading default stats:', error);
      questionsEl.textContent = '709+';
      branchesEl.textContent = '7';
      examsEl.textContent = '2';
    }
  }

  function initVisitorCounter() {
    const el = document.getElementById('visitor-number');
    if (!el) return;

    function animateCount(target) {
      const duration = 1200;
      const startTime = performance.now();
      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(target * easeOut);
        el.textContent = current.toLocaleString();
        if (progress < 1) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
    }

    function updateCounter() {
      let count = parseInt(localStorage.getItem('visitorCount') || '1000');
      const hasVisited = localStorage.getItem('hasVisited');

      if (!hasVisited) {
        count += 1;
        localStorage.setItem('visitorCount', count.toString());
        localStorage.setItem('hasVisited', 'true');
      }

      animateCount(count);
    }

    setTimeout(updateCounter, 400);
  }

  App.calculateResults = calculateResults;
  App.toggleResultsFilter = toggleResultsFilter;
  App.filterAndDisplayResults = filterAndDisplayResults;
  App.renderResults = renderResults;
  App.exportToPDF = exportToPDF;
  App.animateNumber = animateNumber;
  App.loadAndAnimateStats = loadAndAnimateStats;
  App.initVisitorCounter = initVisitorCounter;

  window.toggleResultsFilter = toggleResultsFilter;
  window.exportToPDF = exportToPDF;

})(window.AssamiApp);
