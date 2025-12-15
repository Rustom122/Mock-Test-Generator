window.AssamiApp = window.AssamiApp || {};

(function(App) {
  'use strict';

  function calculateResults() {
    const state = App.appState;
    
    if (state.evaluatedAnswers && state.evaluatedAnswers.length > 0 && state.results?.submitted) {
      return;
    }
    
    let correct = 0, incorrect = 0, unanswered = 0, marked = 0;
    
    state.evaluatedAnswers = [];

    state.userAnswers.forEach((ans, i) => {
      const q = state.examQuestions[i];
      const selectedOption = ans.selectedOption;
      
      let isCorrect = false;
      if (selectedOption !== null) {
        isCorrect = selectedOption === q.correctAnswer;
      }
      
      state.evaluatedAnswers.push({
        questionId: q.id,
        selectedOption: selectedOption,
        correctAnswer: q.correctAnswer,
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
    const allFilters = ['correct', 'incorrect', 'unanswered', 'marked'];
    
    if (state.resultsFilter.has(filterType)) {
      state.resultsFilter.delete(filterType);
      document.querySelector(`[data-filter="${filterType}"]`)?.classList.remove('active');
    } else {
      allFilters.forEach(f => {
        state.resultsFilter.delete(f);
        document.querySelector(`[data-filter="${f}"]`)?.classList.remove('active');
      });
      state.resultsFilter.add(filterType);
      document.querySelector(`[data-filter="${filterType}"]`)?.classList.add('active');
    }
    filterAndDisplayResults();
    
    const reviewSection = document.getElementById('questions-review');
    if (reviewSection && state.resultsFilter.size > 0) {
      setTimeout(() => {
        reviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

  function filterAndDisplayResults() {
    const state = App.appState;
    const reviewContainer = document.getElementById('questions-review');
    if (!reviewContainer) return;
    reviewContainer.innerHTML = '';

    state.examQuestions.forEach((q, i) => {
      const ans = state.userAnswers[i] || {};
      const evalResult = state.evaluatedAnswers?.[i];
      
      const userIndex = evalResult?.selectedOption ?? ans.selectedOption ?? q.userAnswer ?? null;
      const isUnanswered = userIndex === null || userIndex === undefined;
      
      const isCorrect = evalResult?.isCorrect ?? false;
      const isMarked = ans.markedForReview || q.markedForReview;

      let questionType = isUnanswered ? 'unanswered' : (isCorrect ? 'correct' : 'incorrect');
      if (isMarked) questionType = 'marked';

      if (state.resultsFilter.size > 0 && !state.resultsFilter.has(questionType)) return;

      const div = document.createElement('div');
      div.className = `question-review ${isCorrect ? 'correct' : 'incorrect'}`;
      let html = `<div class="review-header"><span><strong>Q${i + 1}.</strong> <span class="badge">ID: ${q.id}</span> <span class="badge">${q.subject}</span> <span class="badge">${q.difficulty}</span></span></div>`;
      html += `<div class="question-text">${q.question}</div><div style="margin-top: 16px;">`;
      
      q.options.forEach((opt, j) => {
        const isUser = userIndex === j;
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
      requestIdleCallback ? requestIdleCallback(() => {
        MathJax.typesetPromise([reviewContainer]).catch(err => console.error('MathJax explanation rendering:', err));
      }) : setTimeout(() => {
        MathJax.typesetPromise([reviewContainer]).catch(err => console.error('MathJax explanation rendering:', err));
      }, 0);
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
    
    requestAnimationFrame(() => {
      filterAndDisplayResults();
    });
  }

  function exportToPDF() {
    const {jsPDF} = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    const brandRed = [185, 28, 28];
    const darkGray = [60, 60, 60];
    const lightGray = [120, 120, 120];
    const successGreen = [34, 139, 34];
    const errorRed = [220, 53, 69];
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    
    function stripLatex(text) {
      if (!text) return '';
      text = text.replace(/\$\$(.*?)\$\$/g, '$1').replace(/\$(.*?)\$/g, '$1');
      text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)');
      text = text.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
      text = text.replace(/([A-Za-z])_\{([^}]+)\}/g, (m, b, s) => b + convertToSubscript(s));
      text = text.replace(/([A-Za-z])_([A-Za-z0-9])/g, (m, b, s) => b + convertToSubscript(s));
      text = text.replace(/\^(\{([^}]+)\}|([0-9]+))/g, (m, f, br, si) => convertToSuperscript(br || si));
      const greekMap = {'\\phi':'φ','\\Phi':'Φ','\\theta':'θ','\\Theta':'Θ','\\omega':'ω','\\Omega':'Ω','\\alpha':'α','\\beta':'β','\\gamma':'γ','\\Gamma':'Γ','\\delta':'δ','\\Delta':'Δ','\\pi':'π','\\Pi':'Π','\\sigma':'σ','\\Sigma':'Σ','\\mu':'μ','\\eta':'η','\\lambda':'λ','\\Lambda':'Λ','\\rho':'ρ','\\tau':'τ','\\sum':'∑','\\prod':'∏','\\times':'×','\\cdot':'·','\\pm':'±','\\mp':'∓','\\div':'÷','\\neq':'≠','\\leq':'≤','\\geq':'≥','\\approx':'≈','\\infty':'∞','\\rightarrow':'→','\\leftarrow':'←','\\degree':'°','\\circ':'°'};
      Object.entries(greekMap).forEach(([k,v]) => { text = text.split(k).join(v); });
      text = text.replace(/\\_/g, '_').replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '');
      return text.trim();
    }
    
    function convertToSubscript(str) {
      const map = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','a':'ₐ','e':'ₑ','i':'ᵢ','n':'ₙ','o':'ₒ','r':'ᵣ','x':'ₓ'};
      return str.split('').map(c => map[c] || c).join('');
    }
    
    function convertToSuperscript(str) {
      const map = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','n':'ⁿ','x':'ˣ'};
      return str.split('').map(c => map[c] || c).join('');
    }
    
    function addHeader(isFirstPage) {
      doc.setFillColor(...brandRed);
      doc.rect(0, 0, pageWidth, 3, 'F');
      doc.rect(0, pageHeight - 3, pageWidth, 3, 'F');
      
      if (isFirstPage) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, 15, contentWidth, 50, 'F');
        doc.setDrawColor(...brandRed);
        doc.setLineWidth(0.5);
        doc.rect(margin, 15, contentWidth, 50);
        
        doc.setFillColor(...brandRed);
        doc.rect(margin, 15, 5, 50, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(32);
        doc.setTextColor(...brandRed);
        doc.text('ASSAMI', margin + 15, 38);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(...darkGray);
        doc.text('AI-Powered Mock Test Platform', margin + 15, 48);
        
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...lightGray);
        doc.text('Excellence Through Practice', margin + 15, 58);
        
        doc.setFillColor(...brandRed);
        doc.roundedRect(pageWidth - margin - 45, 22, 40, 36, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.text(App.appState.results.percentage + '%', pageWidth - margin - 25, 42, {align: 'center'});
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('SCORE', pageWidth - margin - 25, 52, {align: 'center'});
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...brandRed);
        doc.text('ASSAMI', margin, 12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...lightGray);
        doc.text('Mock Test Results', pageWidth - margin, 12, {align: 'right'});
      }
    }
    
    function addFooter(pageNum, totalPages) {
      const footerY = pageHeight - 12;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...lightGray);
      
      const date = new Date().toLocaleDateString('en-US', {year: 'numeric', month: 'long', day: 'numeric'});
      doc.text(date, margin, footerY);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, footerY, {align: 'center'});
      doc.text('www.assami.app', pageWidth - margin, footerY, {align: 'right'});
    }
    
    let yPos = 75;
    addHeader(true);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...darkGray);
    doc.text('EXAMINATION SUMMARY', margin, yPos);
    yPos += 3;
    doc.setDrawColor(...brandRed);
    doc.setLineWidth(1);
    doc.line(margin, yPos, margin + 55, yPos);
    yPos += 10;
    
    const r = App.appState.results;
    const stats = [
      {label: 'Total Questions', value: r.total, color: darkGray},
      {label: 'Correct Answers', value: r.correct, color: successGreen},
      {label: 'Incorrect Answers', value: r.incorrect, color: errorRed},
      {label: 'Unanswered', value: r.unanswered, color: [255, 165, 0]}
    ];
    
    const boxWidth = (contentWidth - 15) / 4;
    stats.forEach((stat, i) => {
      const x = margin + i * (boxWidth + 5);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(x, yPos, boxWidth, 25, 2, 2, 'F');
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, yPos, boxWidth, 25, 2, 2);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...stat.color);
      doc.text(String(stat.value), x + boxWidth/2, yPos + 12, {align: 'center'});
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...lightGray);
      doc.text(stat.label, x + boxWidth/2, yPos + 20, {align: 'center'});
    });
    yPos += 35;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...darkGray);
    doc.text('DETAILED QUESTION ANALYSIS', margin, yPos);
    yPos += 3;
    doc.setDrawColor(...brandRed);
    doc.setLineWidth(1);
    doc.line(margin, yPos, margin + 70, yPos);
    yPos += 12;
    
    App.appState.examQuestions.forEach((q, i) => {
      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 25;
        addHeader(false);
      }
      
      const ans = App.appState.userAnswers[i];
      const isCorrect = ans.selectedOption === q.correctAnswer;
      
      doc.setFillColor(isCorrect ? 240 : 255, isCorrect ? 255 : 240, isCorrect ? 240 : 240);
      const qBoxHeight = 8;
      doc.roundedRect(margin, yPos - 5, contentWidth, qBoxHeight, 1, 1, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...brandRed);
      doc.text(`Question ${i + 1}`, margin + 3, yPos);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...lightGray);
      doc.text(`${q.subject} | ${q.difficulty}`, margin + 35, yPos);
      
      if (isCorrect) doc.setTextColor(...successGreen);
      else doc.setTextColor(...errorRed);
      doc.setFont('helvetica', 'bold');
      doc.text(isCorrect ? '✓ CORRECT' : '✗ INCORRECT', pageWidth - margin - 3, yPos, {align: 'right'});
      yPos += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...darkGray);
      const qText = stripLatex(q.question);
      const qLines = doc.splitTextToSize(qText, contentWidth - 10);
      doc.text(qLines, margin + 5, yPos);
      yPos += qLines.length * 5 + 4;
      
      q.options.forEach((opt, j) => {
        const letter = ['A', 'B', 'C', 'D'][j];
        const isUser = ans.selectedOption === j;
        const isCorrectOpt = j === q.correctAnswer;
        
        let prefix = '○';
        if (isCorrectOpt) prefix = '●';
        else if (isUser && !isCorrect) prefix = '✗';
        
        doc.setFont('helvetica', isUser || isCorrectOpt ? 'bold' : 'normal');
        doc.setFontSize(9);
        
        if (isCorrectOpt) doc.setTextColor(...successGreen);
        else if (isUser && !isCorrect) doc.setTextColor(...errorRed);
        else doc.setTextColor(...darkGray);
        
        const optText = stripLatex(opt);
        const optLines = doc.splitTextToSize(`${prefix} ${letter}. ${optText}`, contentWidth - 15);
        doc.text(optLines, margin + 8, yPos);
        yPos += optLines.length * 4 + 2;
      });
      yPos += 2;
      
      doc.setFillColor(248, 248, 248);
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.2);
      
      const expText = stripLatex(q.explanation);
      const expLines = doc.splitTextToSize(expText, contentWidth - 20);
      const expBoxHeight = expLines.length * 4 + 8;
      
      if (yPos + expBoxHeight > pageHeight - 40) {
        doc.addPage();
        yPos = 25;
        addHeader(false);
      }
      
      doc.roundedRect(margin + 5, yPos - 2, contentWidth - 10, expBoxHeight, 1, 1, 'FD');
      
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(8);
      doc.setTextColor(...brandRed);
      doc.text('Explanation:', margin + 8, yPos + 3);
      
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...darkGray);
      doc.text(expLines, margin + 8, yPos + 8);
      yPos += expBoxHeight + 8;
      
      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.2);
      doc.line(margin + 20, yPos - 3, pageWidth - margin - 20, yPos - 3);
    });
    
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      addFooter(i, pageCount);
    }
    
    doc.save(`Assami_Exam_Report_${new Date().toISOString().split('T')[0]}.pdf`);
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
