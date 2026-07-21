// ============================================
// MindLoop — Complete Frontend Controller
// ============================================

const API_BASE = "http://127.0.0.1:8000";

// --- GLOBAL STATE ---
let activeQuizPayload = null;       // current quiz questions array
let currentExtractedText = "";      // current explanation text for quiz generation
let currentTopic = "";              // current topic being studied
let currentMode = "deep";           // "deep" or "cram"
let cramTimerInterval = null;       // timer interval ID
let cramTimeRemaining = 25 * 60;    // 25 minutes in seconds

// --- CAREER TASK DATA ---
const CAREER_ALIGNED_TASKS = {
    cs: [
        { title: "Optimize FastAPI Backend & SQLite Indexing Layers", due: "3 Days", tracking: "Full-Stack Architecture" },
        { title: "Implement Real-time Data Streams via WebSocket Hooks", due: "5 Days", tracking: "API Engineer Path" }
    ],
    physics: [
        { title: "Simulate Quantum Superposition Vector States in Python", due: "4 Days", tracking: "Research Analyst Track" },
        { title: "Analyze Solid-State Energy Band Gap Data Anomalies", due: "2 Days", tracking: "Applied Physicist Path" }
    ],
    electronics: [
        { title: "Debug Embedded Logic Gates on Microcontroller Prototypes", due: "Next Mon", tracking: "Hardware Engineering" },
        { title: "Design High-Efficiency Voltage Regulator Circuit Schematics", due: "6 Days", tracking: "Mechatronics Development" }
    ],
    robotics: [
        { title: "Map Sensor Telemetry Arrays onto Web Interface Dashboards", due: "4 Days", tracking: "Robotics System Engine" },
        { title: "Refine Motor Calibration Algorithms for Autonomous Drones", due: "1 Week", tracking: "Automation Expert" }
    ]
};

// --- PERSISTENT DATA ---
let userTimetable = JSON.parse(localStorage.getItem('timetable')) || [
    { id: 1, day: "Mon", time: "09:00 - 11:00 AM", tag: "physics", subject: "Quantum Mechanics Core Review", status: "upcoming" },
    { id: 2, day: "Wed", time: "02:00 - 04:00 PM", tag: "electronics", subject: "Embedded Microcontrollers Lab", status: "upcoming" },
    { id: 3, day: "Fri", time: "10:30 - 12:00 PM", tag: "cs", subject: "FastAPI Production API Design", status: "upcoming" }
];

let userAssignments = JSON.parse(localStorage.getItem('assignments')) || [
    { id: 1, title: "Refine Real-time Environmental Data Schemas", due: "2 Days", tracking: "Tech Startup Architecture" }
];

let systemActivityLog = JSON.parse(localStorage.getItem('activityLog')) || {};

// ============================================
// UTILITY
// ============================================

function isMockMode() {
    return document.getElementById('debug-toggle')?.checked || document.getElementById('settings-debug-toggle')?.checked || false;
}

function toggleSettingsMockMode(checked) {
    const headerToggle = document.getElementById('debug-toggle');
    const settingsToggle = document.getElementById('settings-debug-toggle');
    const statusText = document.getElementById('settings-mock-status-text');
    if (headerToggle && headerToggle.checked !== checked) headerToggle.checked = checked;
    if (settingsToggle && settingsToggle.checked !== checked) settingsToggle.checked = checked;
    if (statusText) statusText.innerText = checked ? "Mock Active" : "Mock Inactive";
    refreshProfile();
}

function setupMockModeSync() {
    const headerToggle = document.getElementById('debug-toggle');
    const settingsToggle = document.getElementById('settings-debug-toggle');
    const statusText = document.getElementById('settings-mock-status-text');
    if (headerToggle) {
        headerToggle.addEventListener('change', (e) => {
            if (settingsToggle) settingsToggle.checked = e.target.checked;
            if (statusText) statusText.innerText = e.target.checked ? "Mock Active" : "Mock Inactive";
            refreshProfile();
        });
    }
}

function renderRichText(elementOrId, rawText) {
    const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (!el || !rawText) return;

    if (window.marked) {
        el.innerHTML = marked.parse(rawText);
    } else {
        el.innerHTML = rawText.replace(/\n/g, '<br>');
    }

    if (window.renderMathInElement) {
        try {
            renderMathInElement(el, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '\\[', right: '\\]', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false}
                ],
                throwOnError: false
            });
        } catch (e) {
            console.warn("KaTeX render error:", e);
        }
    }
}

// ============================================
// INITIALIZATION
// ============================================

async function initDashboard() {
    initNavigationRouter();
    setupMockModeSync();
    renderTimetable(userTimetable);
    renderAssignments(userAssignments);
    buildActivityHeatmap();

    // File Upload & Drag-Drop Listeners
    document.getElementById('file-input')?.addEventListener('change', handleFileUpload);
    setupGlobalDragDrop();

    // Profile Load
    await refreshProfile();

    // Initialize cram timer display
    updateTimerDisplay();
}

// ============================================
// STUDY MODE
// ============================================

function setStudyMode(mode) {
    currentMode = mode;
    const deepBtn = document.getElementById('mode-deep');
    const cramBtn = document.getElementById('mode-cram');
    const cramTimer = document.getElementById('cram-timer');
    const settingsDeep = document.getElementById('settings-mode-deep');
    const settingsCram = document.getElementById('settings-mode-cram');

    if (mode === 'deep') {
        if (deepBtn) deepBtn.classList.add('active');
        if (cramBtn) cramBtn.classList.remove('active');
        if (settingsDeep) settingsDeep.classList.add('active');
        if (settingsCram) settingsCram.classList.remove('active');
        if (cramTimer) cramTimer.classList.remove('visible');
        pauseCramTimer();
    } else {
        if (cramBtn) cramBtn.classList.add('active');
        if (deepBtn) deepBtn.classList.remove('active');
        if (settingsCram) settingsCram.classList.add('active');
        if (settingsDeep) settingsDeep.classList.remove('active');
        if (cramTimer) cramTimer.classList.add('visible');
    }
}

function updateSettingsModeUI(mode) {
    setStudyMode(mode);
}

async function resetStudyData() {
    if (!confirm("Are you sure you want to clear all your weak points and reset your study data?")) return;
    try {
        if (window.mockData && window.mockData.profile) {
            window.mockData.profile.weak_points = [];
            window.mockData.profile.xp = 0;
            window.mockData.profile.level = 1;
            window.mockData.profile.streak = 1;
        }
        if (!isMockMode()) {
            await fetch(`${API_BASE}/profile/StudentPro/reset`, { method: 'POST' }).catch(() => {});
        }
        await refreshProfile();
        alert("✅ Study data and weak points successfully cleared!");
    } catch (e) {
        console.error("Reset data error:", e);
        alert("Study data reset to initial state.");
        refreshProfile();
    }
}

// ============================================
// EXPLANATION
// ============================================

async function triggerExplanationFromText(textInput, customTitle = null) {
    if (!textInput || !textInput.trim()) return alert("Please provide text or a topic to study.");

    navigateTo('practice');

    const genBtn = document.getElementById('generate-btn');
    const originalText = genBtn.innerText;
    genBtn.innerHTML = '<span class="loading-spinner"></span> Processing AI Analysis...';
    genBtn.disabled = true;

    try {
        let outputData;
        if (isMockMode()) {
            outputData = { ...window.mockData.explanation };
            if (customTitle) outputData.title = `AI Synthesis: ${customTitle}`;
        } else {
            const res = await fetch(`${API_BASE}/explain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: textInput, username: "StudentPro", mode: currentMode })
            });
            if (!res.ok) throw new Error(`Server returned ${res.status}`);
            outputData = await res.json();
        }

        // Save state for quiz generation
        currentExtractedText = outputData.explanation;
        currentTopic = customTitle || textInput.substring(0, 100);

        // Render title
        const titleEl = document.getElementById('explanation-title');
        if (titleEl) titleEl.innerText = outputData.title || customTitle || textInput.substring(0, 50);

        // Render explanation text (Markdown & KaTeX Math)
        renderRichText('explanation-box', outputData.explanation);

        // Render key takeaways
        const takeawaysSection = document.getElementById('key-takeaways-section');
        const takeawaysList = document.getElementById('key-takeaways-list');
        if (outputData.key_takeaways && outputData.key_takeaways.length > 0) {
            takeawaysList.innerHTML = outputData.key_takeaways
                .map(t => `<li>${t}</li>`)
                .join('');
            if (takeawaysSection) takeawaysSection.style.display = 'block';
            if (window.renderMathInElement) {
                try { renderMathInElement(takeawaysList, { throwOnError: false }); } catch(e){}
            }
        } else {
            if (takeawaysSection) takeawaysSection.style.display = 'none';
        }

        // Hide previous analogy lens if open
        const analogySection = document.getElementById('analogy-section');
        if (analogySection) analogySection.style.display = 'none';

        // Show explanation, hide others
        switchActivePanel('explanation');

        // Gamification toast
        if (outputData.gamification) {
            showXPToast(outputData.gamification);
        }

    } catch (e) {
        console.error("Explanation error:", e);
        alert("Failed to generate AI analysis. Check that the backend server is running locally on port 8000.");
    }

    genBtn.innerHTML = originalText;
    genBtn.disabled = false;
}

async function triggerExplanation() {
    const topic = document.getElementById('topic-input').value.trim();
    if (!topic) return alert("Please enter a concept or topic to study.");
    await triggerExplanationFromText(topic);
}

// ============================================
// QUIZ GENERATION
// ============================================

async function triggerQuizGeneration() {
    if (!currentExtractedText) {
        return alert("Generate an explanation first before creating a quiz.");
    }

    try {
        let quizData;
        if (isMockMode()) {
            quizData = window.mockData.quiz;
        } else {
            const res = await fetch(`${API_BASE}/quiz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    context_text: currentExtractedText,
                    mode: currentMode,
                    num_questions: 4
                })
            });
            if (!res.ok) throw new Error(`Server returned ${res.status}`);
            quizData = await res.json();
        }

        // Handle both "questions" and "quiz" keys from backend
        activeQuizPayload = quizData.questions || quizData.quiz;

        if (!activeQuizPayload || activeQuizPayload.length === 0) {
            return alert("No quiz questions were generated. Try a different topic.");
        }

        // Render quiz form with mixed question types
        const form = document.getElementById('quiz-form');
        form.innerHTML = activeQuizPayload.map((q, idx) => {
            const qType = q.type || 'mcq';

            if (qType === 'mcq') {
                // MCQ: radio buttons
                const entries = Array.isArray(q.options)
                    ? q.options.map((v, i) => [String.fromCharCode(65 + i), v])
                    : Object.entries(q.options || {});

                return `
                    <div class="quiz-question-block" data-type="mcq">
                        <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
                            <span class="field-pill" style="background: rgba(37, 99, 235, 0.1); color: var(--primary-blue);">MCQ</span>
                            <span style="font-size:0.78rem; color:var(--secondary-text);">${q.concept_tag?.replace(/_/g, ' ') || ''}</span>
                        </div>
                        <p>${idx + 1}. ${q.question}</p>
                        ${entries.map(([k, v]) => `
                            <label>
                                <input type="radio" name="q-${q.id}" value="${k}">
                                <span>${k}: ${v}</span>
                            </label>
                        `).join('')}
                    </div>`;

            } else if (qType === 'structural') {
                // Structural: textarea for worked solutions
                return `
                    <div class="quiz-question-block" data-type="structural">
                        <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
                            <span class="field-pill" style="background: rgba(124, 58, 237, 0.1); color: var(--purple-accent);">📐 Structural</span>
                            <span style="font-size:0.78rem; color:var(--secondary-text);">${q.concept_tag?.replace(/_/g, ' ') || ''}</span>
                        </div>
                        <p>${idx + 1}. ${q.question}</p>
                        ${q.hint ? `<div style="background: rgba(250, 204, 21, 0.1); border-left: 3px solid #FACC15; padding: 10px 14px; border-radius: 8px; margin: 10px 0; font-size: 0.88rem; color: #854D0E;">💡 <strong>Hint:</strong> ${q.hint}</div>` : ''}
                        <textarea name="q-${q.id}" class="structural-answer" placeholder="Show your full working here... Write each step clearly." rows="6" style="width:100%; padding:14px; border:1.5px solid var(--border); border-radius:12px; font-family:var(--font-global); font-size:0.94rem; resize:vertical; background:var(--white); color:var(--primary-text); outline:none; transition:var(--transition-smooth);" onfocus="this.style.borderColor='var(--purple-accent)'; this.style.boxShadow='0 0 0 4px rgba(124,58,237,0.12)'" onblur="this.style.borderColor='var(--border)'; this.style.boxShadow='none'"></textarea>
                    </div>`;

            } else if (qType === 'code') {
                // Code: code textarea
                return `
                    <div class="quiz-question-block" data-type="code">
                        <div style="display:flex; gap:8px; align-items:center; margin-bottom:10px;">
                            <span class="field-pill" style="background: rgba(34, 197, 94, 0.1); color: var(--success);">💻 Code Challenge</span>
                            <span style="font-size:0.78rem; color:var(--secondary-text);">${q.concept_tag?.replace(/_/g, ' ') || ''}</span>
                        </div>
                        <p>${idx + 1}. ${q.question}</p>
                        ${q.hint ? `<div style="background: rgba(250, 204, 21, 0.1); border-left: 3px solid #FACC15; padding: 10px 14px; border-radius: 8px; margin: 10px 0; font-size: 0.88rem; color: #854D0E;">💡 <strong>Hint:</strong> ${q.hint}</div>` : ''}
                        <textarea name="q-${q.id}" class="code-answer" placeholder="Write your code solution here..." rows="8" style="width:100%; padding:14px; border:1.5px solid var(--border); border-radius:12px; font-family:'Courier New', Consolas, monospace; font-size:0.9rem; resize:vertical; background:#1E293B; color:#E2E8F0; outline:none; transition:var(--transition-smooth); tab-size:4;" onfocus="this.style.borderColor='var(--success)'; this.style.boxShadow='0 0 0 4px rgba(34,197,94,0.12)'" onblur="this.style.borderColor='var(--border)'; this.style.boxShadow='none'" onkeydown="if(event.key==='Tab'){event.preventDefault();var s=this.selectionStart;var e=this.selectionEnd;this.value=this.value.substring(0,s)+'    '+this.value.substring(e);this.selectionStart=this.selectionEnd=s+4;}"></textarea>
                    </div>`;
            }

            return ''; // fallback
        }).join('');

        // Render KaTeX equations inside questions if present
        if (window.renderMathInElement) {
            try { renderMathInElement(form, { throwOnError: false }); } catch (e) {}
        }

        // Show quiz, hide others
        switchActivePanel('quiz');

    } catch (e) {
        console.error("Quiz generation error:", e);
        alert("Failed to generate quiz. Check that the backend server is running.");
    }
}

// ============================================
// EVALUATION
// ============================================

async function triggerEvaluation() {
    if (!activeQuizPayload) return alert("No active quiz to evaluate.");

    // Collect user answers — supports MCQ (radio), structural (textarea), and code (textarea)
    const userAnswers = {};
    let allAnswered = true;
    activeQuizPayload.forEach(q => {
        const qType = q.type || 'mcq';
        if (qType === 'mcq') {
            const selected = document.querySelector(`input[name="q-${q.id}"]:checked`);
            if (selected) {
                userAnswers[String(q.id)] = selected.value;
            } else {
                allAnswered = false;
            }
        } else {
            // structural or code — get textarea value
            const textarea = document.querySelector(`textarea[name="q-${q.id}"]`);
            if (textarea && textarea.value.trim()) {
                userAnswers[String(q.id)] = textarea.value.trim();
            } else {
                allAnswered = false;
            }
        }
    });

    if (!allAnswered) {
        return alert("Please answer all questions before submitting.");
    }

    try {
        let evalData;
        if (isMockMode()) {
            evalData = window.mockData.evaluation;
        } else {
            const res = await fetch(`${API_BASE}/evaluate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quiz_data: activeQuizPayload,
                    user_answers: userAnswers,
                    topic: currentTopic,
                    username: "StudentPro"
                })
            });
            if (!res.ok) throw new Error(`Server returned ${res.status}`);
            evalData = await res.json();
        }

        // Render score circle
        const scoreCircle = document.getElementById('score-circle');
        scoreCircle.innerText = `${evalData.score}/${evalData.total_questions}`;
        scoreCircle.className = `score-circle ${evalData.passed ? 'pass' : 'fail'}`;

        // Headline
        const headline = document.getElementById('eval-headline');
        headline.innerText = evalData.passed ? "🎉 Great Job!" : "📚 Keep Studying!";

        const subtext = document.getElementById('eval-subtext');
        subtext.innerText = evalData.passed
            ? `You passed with ${evalData.score}/${evalData.total_questions} correct.`
            : `You scored ${evalData.score}/${evalData.total_questions}. Review the weak areas below.`;

        // Weak points
        const weakSection = document.getElementById('weak-points-section');
        const weakList = document.getElementById('weak-points-list');
        if (evalData.weak_points && evalData.weak_points.length > 0) {
            weakList.innerHTML = evalData.weak_points.map(concept => `
                <li class="weak-point-item">
                    <span class="concept-name">${concept.replace(/_/g, ' ')}</span>
                    <button class="restudy-btn" onclick="triggerReexplanation('${concept}')">🔄 Re-study</button>
                </li>
            `).join('');
            weakSection.style.display = 'block';
        } else {
            weakSection.style.display = 'none';
        }

        // Per-question detailed feedback (for structural/code answers)
        const perQFeedback = evalData.per_question_feedback || [];
        let detailedHTML = '';
        if (perQFeedback.length > 0) {
            detailedHTML = '<div style="margin-top: 20px;"><h4 style="color: var(--primary-blue); font-family: var(--font-heading); margin-bottom: 14px;">📋 Detailed Question-by-Question Feedback</h4>';
            
            activeQuizPayload.forEach((q, idx) => {
                const qType = q.type || 'mcq';
                const pqf = perQFeedback.find(f => f.id === q.id) || {};
                const isCorrect = pqf.correct;
                const comment = pqf.comment || '';
                const userAns = evalData.results?.find(r => r.question_id === q.id)?.user_answer || '';

                const typeBadge = qType === 'mcq' 
                    ? '<span class="field-pill" style="background:rgba(37,99,235,0.1); color:var(--primary-blue);">MCQ</span>'
                    : qType === 'structural'
                    ? '<span class="field-pill" style="background:rgba(124,58,237,0.1); color:var(--purple-accent);">📐 Structural</span>'
                    : '<span class="field-pill" style="background:rgba(34,197,94,0.1); color:var(--success);">💻 Code</span>';

                const statusIcon = isCorrect ? '✅' : '❌';
                const borderColor = isCorrect ? 'var(--success)' : 'var(--danger)';

                detailedHTML += `
                    <div style="background: var(--background); border-left: 4px solid ${borderColor}; border-radius: 12px; padding: 16px 20px; margin-bottom: 12px; border: 1px solid var(--border); border-left: 4px solid ${borderColor};">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                            <div style="display:flex; gap:8px; align-items:center;">
                                <span style="font-size:1.1rem;">${statusIcon}</span>
                                <strong style="color: var(--primary-text);">Q${idx + 1}</strong>
                                ${typeBadge}
                            </div>
                            <span style="font-size:0.82rem; color: ${isCorrect ? 'var(--success)' : 'var(--danger)'}; font-weight:700;">${isCorrect ? 'Correct' : 'Incorrect'}</span>
                        </div>
                        <p style="font-size:0.92rem; color:var(--primary-text); margin-bottom:8px;"><em>${q.question.substring(0, 120)}${q.question.length > 120 ? '...' : ''}</em></p>
                        ${comment ? `<p style="font-size:0.88rem; color:var(--secondary-text); line-height:1.5;">${comment}</p>` : ''}
                        ${(qType !== 'mcq' && !isCorrect) ? `
                            <details style="margin-top:10px;">
                                <summary style="cursor:pointer; color:var(--primary-blue); font-weight:700; font-size:0.88rem;">📖 View Model Answer</summary>
                                <pre style="margin-top:8px; background:#1E293B; color:#E2E8F0; padding:14px; border-radius:10px; font-size:0.85rem; overflow-x:auto; white-space:pre-wrap; line-height:1.5;">${q.correct_answer}</pre>
                            </details>
                        ` : ''}
                        ${(qType !== 'mcq' && userAns) ? `
                            <details style="margin-top:8px;">
                                <summary style="cursor:pointer; color:var(--secondary-text); font-weight:600; font-size:0.85rem;">👤 Your Answer</summary>
                                <pre style="margin-top:8px; background:var(--background); padding:12px; border-radius:10px; border:1px solid var(--border); font-size:0.85rem; overflow-x:auto; white-space:pre-wrap;">${userAns}</pre>
                            </details>
                        ` : ''}
                    </div>`;
            });

            detailedHTML += '</div>';
        }

        // Feedback (Render markdown summary + detailed breakdown, then run KaTeX math)
        const evalFeedbackEl = document.getElementById('eval-feedback');
        const formattedSummary = window.marked ? marked.parse(evalData.feedback || '') : (evalData.feedback || '').replace(/\n/g, '<br>');
        evalFeedbackEl.innerHTML = formattedSummary + detailedHTML;
        if (window.renderMathInElement) {
            try { renderMathInElement(evalFeedbackEl, { throwOnError: false }); } catch (e) {}
        }

        // Show eval results, hide others
        switchActivePanel('eval');

        // Gamification toast
        if (evalData.gamification) {
            showXPToast(evalData.gamification);
        }

        // Log activity in heatmap
        logHeatmapActivity();

    } catch (e) {
        console.error("Evaluation error:", e);
        alert("Failed to evaluate quiz. Check that the backend server is running.");
    }
}

// ============================================
// RE-EXPLANATION
// ============================================

async function triggerReexplanation(concept) {
    if (!concept) return;
    navigateTo('practice');
    if (!currentTopic) currentTopic = concept;
    if (!currentExtractedText) currentExtractedText = `Targeted conceptual review for: ${concept}`;
    try {
        let reData;
        if (isMockMode()) {
            reData = window.mockData.reexplanation;
        } else {
            const res = await fetch(`${API_BASE}/reexplain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: currentTopic,
                    original_explanation: currentExtractedText,
                    weak_points: [concept],
                    mode: currentMode
                })
            });
            if (!res.ok) throw new Error(`Server returned ${res.status}`);
            reData = await res.json();
        }

        // Render re-explanation (Markdown & KaTeX Math)
        document.getElementById('reexplain-title').innerText = reData.title || `Re-Explanation: ${concept}`;
        renderRichText('reexplain-box', reData.re_explanation);
        renderRichText('reexplain-reassurance', reData.reassurance || '');

        // Show reexplain, hide others
        switchActivePanel('reexplain');

    } catch (e) {
        console.error("Re-explanation error:", e);
        alert("Failed to get re-explanation. Check that the backend server is running.");
    }
}

function triggerRetestAfterReexplain() {
    switchActivePanel('none');
    triggerQuizGeneration();
}

// ============================================
// FLASHCARDS GENERATION
// ============================================

async function triggerFlashcardsGeneration() {
    if (!currentExtractedText) {
        return alert("Please generate an explanation for a topic first before creating flashcards.");
    }

    switchActivePanel('flashcards');
    const gridEl = document.getElementById('flashcards-grid');
    const badgeEl = document.getElementById('flashcards-mode-badge');
    if (badgeEl) badgeEl.innerText = `✨ ${currentMode.toUpperCase()} Mode Cards`;
    if (gridEl) {
        gridEl.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--secondary-text);">
            <div style="font-size: 2rem; margin-bottom: 10px;">⏳</div>
            <p style="font-weight: 600;">Generating ${currentMode.toUpperCase()} mode flashcards...</p>
        </div>`;
    }

    try {
        let cardsData = null;
        if (isMockMode()) {
            await new Promise(r => setTimeout(r, 600));
            cardsData = window.mockData.flashcards;
        } else {
            const res = await fetch(`${API_BASE}/flashcards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: currentExtractedText,
                    mode: currentMode
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || `Server error (${res.status})`);
            }
            cardsData = await res.json();
        }

        const cards = cardsData?.flashcards || [];
        if (gridEl) {
            if (cards.length === 0) {
                gridEl.innerHTML = `<p style="color: var(--secondary-text); text-align: center;">No flashcards generated.</p>`;
                return;
            }
            gridEl.innerHTML = cards.map((card, idx) => `
                <div class="flashcard-item" onclick="this.classList.toggle('flipped')">
                    <div class="flashcard-front">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary-blue); text-transform: uppercase;">Card ${idx + 1} • Front (${currentMode === 'cram' ? 'Term / Fact' : 'Concept / Question'})</span>
                            <span style="font-size: 0.75rem; color: var(--secondary-text);">👆 Tap to Flip</span>
                        </div>
                        <p style="font-size: 1.1rem; font-weight: 700; color: var(--primary-text); line-height: 1.5;">${card.front}</p>
                    </div>
                    <div class="flashcard-back">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-size: 0.75rem; font-weight: 700; color: var(--purple-accent); text-transform: uppercase;">Card ${idx + 1} • Back (${currentMode === 'cram' ? 'Quick Recall' : 'Detailed Explanation'})</span>
                            <span style="font-size: 0.75rem; color: var(--secondary-text);">👆 Tap to Flip</span>
                        </div>
                        <p style="font-size: 1.05rem; color: var(--primary-text); line-height: 1.6;">${card.back}</p>
                    </div>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error("Flashcards generation error:", e);
        if (gridEl) {
            gridEl.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--danger);">
                <p style="font-weight: 700;">Failed to generate flashcards: ${e.message}</p>
            </div>`;
        }
    }
}

// ============================================
// ANALOGY GENERATION
// ============================================

async function triggerAnalogyGeneration() {
    if (!currentExtractedText) {
        return alert("Please generate an explanation for a topic first before creating an analogy.");
    }

    const analogySection = document.getElementById('analogy-section');
    const analogyBox = document.getElementById('analogy-box');
    if (analogySection) analogySection.style.display = 'block';
    if (analogyBox) analogyBox.innerHTML = '<span class="loading-spinner"></span> Generating real-world analogy...';

    try {
        let analogyText = "";
        if (isMockMode()) {
            await new Promise(r => setTimeout(r, 500));
            analogyText = window.mockData?.analogy?.analogy || "Imagine backpropagation as tuning the instruments in a grand orchestra...";
        } else {
            const res = await fetch(`${API_BASE}/analogy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: currentExtractedText,
                    mode: currentMode
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || `Server error (${res.status})`);
            }
            const data = await res.json();
            analogyText = data.analogy || "";
        }

        if (analogyBox) {
            renderRichText('analogy-box', analogyText);
        }
    } catch (e) {
        console.error("Analogy generation error:", e);
        if (analogyBox) {
            analogyBox.innerHTML = `<span style="color: var(--danger);">Failed to generate analogy: ${e.message}</span>`;
        }
    }
}

// ============================================
// RESET
// ============================================

function resetForNewTopic() {
    // Hide all panels and sections
    switchActivePanel('none');
    const analogySection = document.getElementById('analogy-section');
    if (analogySection) analogySection.style.display = 'none';

    // Clear state
    document.getElementById('topic-input').value = '';
    activeQuizPayload = null;
    currentExtractedText = '';
    currentTopic = '';
}

// ============================================
// PANEL VISIBILITY HELPERS
// ============================================

function switchActivePanel(panelName) {
    const emptyState = document.getElementById('practice-empty-state');
    const expCard = document.getElementById('explanation-card');
    const quizCard = document.getElementById('quiz-card');
    const flashcardsCard = document.getElementById('flashcards-card');

    if (emptyState) emptyState.style.display = (panelName === 'none') ? 'block' : 'none';
    if (expCard) expCard.style.display = (panelName === 'explanation') ? 'block' : 'none';
    if (quizCard) quizCard.style.display = (panelName === 'quiz') ? 'block' : 'none';
    if (flashcardsCard) flashcardsCard.style.display = (panelName === 'flashcards') ? 'block' : 'none';

    if (panelName === 'eval') showPanel('eval-results-card'); else hidePanel('eval-results-card');
    if (panelName === 'reexplain') showPanel('reexplain-card'); else hidePanel('reexplain-card');
}

function showPanel(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('visible');
}

function hidePanel(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
}

// ============================================
// XP TOAST & PROFILE
// ============================================

function showXPToast(gamification) {
    const toast = document.getElementById('xp-toast');
    const msg = document.getElementById('toast-msg');
    if (!toast || !msg) return;

    let text = `+${gamification.xp_earned} XP Earned!`;
    if (gamification.level_up_occurred) {
        text += ` 🎉 Level Up to ${gamification.current_level}!`;
    }
    msg.innerText = text;

    toast.classList.add('active');
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);

    // Refresh profile with new data
    refreshProfile();
}

let currentUserProfile = null;

async function refreshProfile() {
    const defaultProfile = { username: "SP", level: 1, streak: 1, xp: 0, xp_next_level: 200, weak_points: [] };
    try {
        if (isMockMode()) {
            renderProfile(window.mockData?.profile || defaultProfile);
        } else {
            const res = await fetch(`${API_BASE}/profile/StudentPro`);
            if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
            const data = await res.json();
            renderProfile(data);
        }
    } catch (err) {
        console.warn("Profile load fallback:", err);
        renderProfile(defaultProfile);
    }
}

function renderProfile(data) {
    currentUserProfile = data;

    const weakPoints = data.weak_points || [];
    const modBadge = document.getElementById('modules-count-badge');
    const notifBadge = document.getElementById('notifications-count-badge');
    if (modBadge) modBadge.innerText = `${weakPoints.length} Active Modules`;
    if (notifBadge) notifBadge.innerText = `${weakPoints.length + 2} Alerts`;

    const usernameEl = document.getElementById('ui-username');
    const levelEl = document.getElementById('ui-level');
    const streakEl = document.getElementById('ui-streak');
    const xpTextEl = document.getElementById('ui-xp-text');
    const xpBarEl = document.getElementById('ui-xp-bar');

    // Dashboard & Achievements card elements
    const dashLevelEl = document.getElementById('dash-level');
    const dashStreakEl = document.getElementById('dash-streak');
    const dashXpTextEl = document.getElementById('dash-xp-text');
    const dashXpBarEl = document.getElementById('dash-xp-bar');

    const achLevelEl = document.getElementById('ach-level');
    const achStreakEl = document.getElementById('ach-streak');
    const achXpTextEl = document.getElementById('ach-xp-text');
    const achXpBarEl = document.getElementById('ach-xp-bar');

    const dashGreetingName = document.getElementById('dash-greeting-name');
    const dashModulesCount = document.getElementById('dash-modules-count');
    if (dashGreetingName && data.username) {
        dashGreetingName.innerText = data.username;
    }
    if (dashModulesCount) {
        const count = weakPoints.length > 0 ? weakPoints.length : 5;
        dashModulesCount.innerText = `${count} concepts`;
    }

    if (usernameEl && data.username) {
        usernameEl.innerText = data.username.substring(0, 2).toUpperCase();
    }
    const levelVal = data.level || 1;
    if (levelEl) levelEl.innerText = levelVal;
    if (dashLevelEl) dashLevelEl.innerText = `Level ${levelVal}`;
    if (achLevelEl) achLevelEl.innerText = `Level ${levelVal}`;

    const streakVal = data.streak || 1;
    if (streakEl) streakEl.innerText = `🔥 ${streakVal} Day Streak`;
    if (dashStreakEl) dashStreakEl.innerText = `🔥 ${streakVal} Day`;
    if (achStreakEl) achStreakEl.innerText = `🔥 ${streakVal} Day`;

    const nextLevelXP = data.xp_next_level || 200;
    const currentXP = data.xp || 0;
    const xpStr = `${currentXP} / ${nextLevelXP} XP`;
    const xpPercent = `${Math.min((currentXP / nextLevelXP) * 100, 100)}%`;

    if (xpTextEl) xpTextEl.innerText = xpStr;
    if (dashXpTextEl) dashXpTextEl.innerText = xpStr;
    if (achXpTextEl) achXpTextEl.innerText = xpStr;
    if (xpBarEl) xpBarEl.style.width = xpPercent;
    if (dashXpBarEl) dashXpBarEl.style.width = xpPercent;
    if (achXpBarEl) achXpBarEl.style.width = xpPercent;
}

// ============================================
// CRAM TIMER
// ============================================

function startCramTimer() {
    if (cramTimerInterval) return; // Already running
    const btn = document.getElementById('cram-timer-btn');
    if (btn) btn.innerText = "⏸ Pause";

    cramTimerInterval = setInterval(() => {
        cramTimeRemaining--;
        updateCountdownDisplay();

        if (cramTimeRemaining <= 0) {
            stopCramTimer();
            const timerContainer = document.getElementById('cram-timer');
            if (timerContainer) timerContainer.classList.remove('warning');
            alert("⏰ Cram session complete! Time to review what you've learned.");
        }
    }, 1000);
}

function pauseCramTimer() {
    if (cramTimerInterval) {
        clearInterval(cramTimerInterval);
        cramTimerInterval = null;
    }
    const btn = document.getElementById('cram-timer-btn');
    if (btn) btn.innerText = "▶ Start";
}

function stopCramTimer() {
    pauseCramTimer();
}

function toggleCramTimer() {
    if (cramTimerInterval) {
        stopCramTimer();
    } else {
        startCramTimer();
    }
}

function resetCramTimer() {
    pauseCramTimer();
    const minutesInput = document.getElementById('cram-minutes');
    const totalMins = minutesInput ? (parseInt(minutesInput.value, 10) || 25) : 25;
    cramTimeRemaining = totalMins * 60;
    updateCountdownDisplay();
    const timerContainer = document.getElementById('cram-timer');
    if (timerContainer) timerContainer.classList.remove('warning');
}

function updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    const countdownEl = document.getElementById('cram-countdown');
    const minutes = Math.floor(Math.max(0, cramTimeRemaining) / 60);
    const seconds = Math.max(0, cramTimeRemaining) % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    if (display) display.innerText = timeStr;
    if (countdownEl) countdownEl.innerText = timeStr;

    // Minimum DOM hook added to update stroke-dashoffset on circular progress ring:
    const ringCircle = document.getElementById('cram-ring-circle');
    const minutesInput = document.getElementById('cram-minutes');
    const totalSeconds = (minutesInput ? (parseInt(minutesInput.value, 10) || 25) : 25) * 60;

    if (ringCircle && totalSeconds > 0) {
        const circumference = 2 * Math.PI * 54; // 339.292
        const progress = Math.max(0, Math.min(1, cramTimeRemaining / totalSeconds));
        const dashoffset = circumference - (progress * circumference);
        ringCircle.style.strokeDashoffset = dashoffset;
    }

    const timerContainer = document.getElementById('cram-timer');
    if (timerContainer && totalSeconds > 0) {
        if (cramTimeRemaining <= totalSeconds * 0.1 && cramTimeRemaining > 0) {
            timerContainer.classList.add('warning');
        } else {
            timerContainer.classList.remove('warning');
        }
    }
}

function updateCountdownDisplay() {
    updateTimerDisplay();
}

// ============================================
// HEATMAP
// ============================================

function buildActivityHeatmap() {
    const grid = document.getElementById('github-heatmap');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < 189; i++) {
        const cell = document.createElement('div');
        cell.className = `heatmap-cell ${systemActivityLog[i] ? 'level-' + systemActivityLog[i] : ''}`;
        grid.appendChild(cell);
    }
}

function logHeatmapActivity() {
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const cellIndex = dayOfYear % 189;
    const currentLevel = systemActivityLog[cellIndex] || 0;
    systemActivityLog[cellIndex] = Math.min(currentLevel + 1, 3);
    localStorage.setItem('activityLog', JSON.stringify(systemActivityLog));
    buildActivityHeatmap();
}

// ============================================
// TIMETABLE & ASSIGNMENTS
// ============================================

let currentScheduleViewMode = 'kanban';
let currentScheduleFilterTag = 'all';

function setScheduleViewMode(mode) {
    currentScheduleViewMode = mode;
    document.getElementById('tab-kanban')?.classList.toggle('active', mode === 'kanban');
    document.getElementById('tab-table')?.classList.toggle('active', mode === 'table');
    renderTimetable(userTimetable);
}

function setScheduleTagFilter(tag, btnEl) {
    currentScheduleFilterTag = tag;
    document.querySelectorAll('.notion-filter-pill').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    renderTimetable(userTimetable);
}

function toggleTimetableStatus(id) {
    const item = userTimetable.find(x => x.id === id);
    if (item) {
        item.status = item.status === 'done' ? 'upcoming' : 'done';
        saveAndSync();
    }
}

function quickAddSlotForDay(day) {
    const daySelect = document.getElementById('schedule-day');
    if (daySelect) daySelect.value = day;
    document.getElementById('schedule-subject')?.focus();
}

function renderTimetable(list) {
    const box = document.getElementById('timetable-container');
    if (!box) return;

    // Filter by active tag if not all
    const filtered = currentScheduleFilterTag === 'all' 
        ? list 
        : list.filter(item => item.tag === currentScheduleFilterTag);

    if (currentScheduleViewMode === 'kanban') {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        box.innerHTML = `<div class="notion-kanban-board">` + days.map(day => {
            const dayItems = filtered.filter(item => item.day === day);
            return `
                <div class="notion-kanban-column">
                    <div class="notion-column-header">
                        <span class="notion-day-title">📌 ${day}</span>
                        <span class="notion-count-badge">${dayItems.length}</span>
                    </div>
                    <div class="notion-kanban-cards">
                        ${dayItems.length === 0 ? `<div style="color:var(--secondary-text); font-size:0.8rem; text-align:center; padding: 20px 0; opacity:0.6;">No slots scheduled</div>` : ''}
                        ${dayItems.map(item => `
                            <div class="notion-slot-card">
                                <div class="notion-slot-time">
                                    <span>🕒 ${item.time || 'Flexible'}</span>
                                    <span class="field-pill pill-${item.tag}" style="margin-left:auto; font-size:0.7rem;">${item.tag.toUpperCase()}</span>
                                </div>
                                <div class="notion-slot-title">${item.subject}</div>
                                <div class="notion-slot-footer">
                                    <span class="notion-slot-status ${item.status || 'upcoming'}" style="cursor:pointer;" onclick="toggleTimetableStatus(${item.id})">${(item.status || 'upcoming').toUpperCase()}</span>
                                    <div class="notion-slot-actions">
                                        <button title="Study with AI Tutor" style="background:none; border:none; cursor:pointer; font-size:0.9rem;" onclick="navigateTo('practice'); document.getElementById('topic-input').value='${item.subject}'; triggerExplanation();">⚡</button>
                                        <button class="delete-btn" onclick="deleteTimetableSlot(${item.id})">❌</button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <button class="notion-add-slot-btn" onclick="quickAddSlotForDay('${day}')">＋ Add Slot</button>
                </div>
            `;
        }).join('') + `</div>`;
    } else {
        // Table Database view
        box.innerHTML = `
            <table class="notion-database-table">
                <thead>
                    <tr>
                        <th>Day</th>
                        <th>Time</th>
                        <th>Subject Focus</th>
                        <th>Tag</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--secondary-text);">No schedule slots matching current filter</td></tr>` : ''}
                    ${filtered.map(item => `
                        <tr>
                            <td><strong style="color:var(--primary-blue);">${item.day}</strong></td>
                            <td><span style="font-size:0.85rem; color:var(--secondary-text);">🕒 ${item.time || 'Flexible'}</span></td>
                            <td><strong>${item.subject}</strong></td>
                            <td><span class="field-pill pill-${item.tag}">${item.tag.toUpperCase()}</span></td>
                            <td>
                                <span class="notion-slot-status ${item.status || 'upcoming'}" style="cursor:pointer;" onclick="toggleTimetableStatus(${item.id})">${(item.status || 'upcoming').toUpperCase()}</span>
                            </td>
                            <td>
                                <div style="display:flex; gap:8px; align-items:center;">
                                    <button class="resume-btn" style="padding:4px 10px; font-size:0.78rem;" onclick="navigateTo('practice'); document.getElementById('topic-input').value='${item.subject}'; triggerExplanation();">⚡ Study</button>
                                    <button class="delete-btn" onclick="deleteTimetableSlot(${item.id})">❌</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

function renderAssignments(list) {
    const box = document.getElementById('assignment-container');
    if (!box) return;
    box.innerHTML = list.map(item => `
        <div class="notion-item-row">
            <div><strong>${item.title}</strong><br><small>🎯 Path: ${item.tracking}</small></div>
            <span>⏰ ${item.due}</span>
        </div>`).join('');
}

function addScheduleSlot() {
    const day = document.getElementById('schedule-day').value;
    const timeEl = document.getElementById('schedule-time');
    const time = timeEl ? timeEl.value.trim() || "Flexible Slot" : "Flexible Slot";
    const tag = document.getElementById('schedule-tag').value;
    const subject = document.getElementById('schedule-subject').value;
    if (!subject) return alert("Enter a subject.");
    userTimetable.push({ id: Date.now(), day, time, tag, subject, status: 'upcoming' });
    saveAndSync();
    document.getElementById('schedule-subject').value = '';
    if (timeEl) timeEl.value = '';
}

function deleteTimetableSlot(id) {
    userTimetable = userTimetable.filter(item => item.id !== id);
    saveAndSync();
}

function saveAndSync() {
    localStorage.setItem('timetable', JSON.stringify(userTimetable));
    localStorage.setItem('assignments', JSON.stringify(userAssignments));
    renderTimetable(userTimetable);
    renderAssignments(userAssignments);
}

function generateSmartAssignment() {
    const tags = userTimetable.map(t => t.tag);
    if (tags.length === 0) return alert("Add timetable entries first.");
    const randomTag = tags[Math.floor(Math.random() * tags.length)];
    const tasks = CAREER_ALIGNED_TASKS[randomTag];
    if (!tasks || tasks.length === 0) return;
    const task = tasks[Math.floor(Math.random() * tasks.length)];
    userAssignments.push({ id: Date.now(), ...task });
    saveAndSync();
}

// ============================================
// NAVIGATION ROUTER
// ============================================

function navigateTo(target) {
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const allViews = document.querySelectorAll('.router-view');
    const genericView = document.getElementById('view-generic');
    const genericTitle = document.getElementById('generic-view-title');

    menuItems.forEach(nav => {
        if (nav.dataset.target === target) {
            nav.classList.add('active');
        } else {
            nav.classList.remove('active');
        }
    });

    allViews.forEach(v => v.classList.remove('active-view'));

    const specificView = document.getElementById(`view-${target}`);
    if (specificView) {
        specificView.classList.add('active-view');
        if (target === 'modules') renderModulesView();
        if (target === 'notifications') renderNotificationsView();
    } else {
        if (genericView) genericView.classList.add('active-view');
        if (genericTitle) {
            genericTitle.innerText = 'Workspace View';
        }
    }
}

function renderModulesView() {
    const container = document.getElementById('modules-list-container');
    if (!container) return;

    const weakPoints = currentUserProfile?.weak_points || window.mockData?.profile?.weak_points || [];
    if (weakPoints.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; background: var(--white); border-radius: 12px; border: 1px dashed #D1D5DB;">
                <div style="font-size: 2.8rem; margin-bottom: 12px;">🏆</div>
                <h4 style="font-size: 1.15rem; color: var(--text-charcoal-dark); margin-bottom: 6px;">All Core Concepts Mastered!</h4>
                <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 420px; margin: 0 auto;">You currently have no active conceptual weak points. Continue studying or take quizzes in AI Practice to challenge your understanding.</p>
            </div>`;
        return;
    }

    container.innerHTML = weakPoints.map(wp => {
        const tag = typeof wp === 'string' ? wp : (wp.concept_tag || 'Concept');
        const formattedTitle = tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const topic = typeof wp === 'string' ? tag : (wp.topic || 'General AI Practice');
        const missedCount = typeof wp === 'string' ? 1 : (wp.times_missed || 1);

        return `
            <div style="background: var(--white); border: 1px solid #E5E7EB; border-radius: 12px; padding: 18px 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                        <span style="background: #FFF1F2; color: #E11D48; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">⚠️ Missed ${missedCount}x</span>
                        <span style="font-size: 0.8rem; color: var(--text-muted);">Topic: ${topic}</span>
                    </div>
                    <h4 style="font-size: 1.15rem; color: var(--text-charcoal-dark); margin: 0;">${formattedTitle}</h4>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="action-trigger-btn" style="padding: 10px 16px; font-size: 0.85rem; margin: 0; background: var(--white); color: var(--primary-blue); border: 1px solid var(--primary-blue);" onclick="triggerReexplanation('${tag}')">🔄 Re-Explain</button>
                    <button class="action-trigger-btn primary-intent" style="padding: 10px 16px; font-size: 0.85rem; margin: 0;" onclick="triggerExplanationFromText('${topic}')">🎓 Study Topic</button>
                </div>
            </div>`;
    }).join('');
}

function renderNotificationsView() {
    const container = document.getElementById('notifications-list-container');
    if (!container) return;

    const profile = currentUserProfile || window.mockData?.profile || { level: 1, streak: 1, xp: 0, xp_next_level: 200, weak_points: [] };
    const weakPoints = profile.weak_points || [];

    const notifications = [];

    // Streak protection reminder
    if (profile.streak && profile.streak > 0) {
        notifications.push({
            icon: "🔥",
            color: "#ff6b6b",
            title: `Streak Protection Alert (${profile.streak} Day Streak)`,
            message: `You are on a ${profile.streak}-day study streak! Complete at least 1 quick knowledge check or explanation today to preserve your momentum and prevent XP decay.`,
            btnText: "🚀 Start Quick Check",
            action: "navigateTo('practice')"
        });
    }

    // Weak points reminders
    if (weakPoints.length > 0) {
        weakPoints.slice(0, 3).forEach(wp => {
            const tag = typeof wp === 'string' ? wp : (wp.concept_tag || 'Concept');
            const formattedTitle = tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const topic = typeof wp === 'string' ? tag : (wp.topic || 'General Practice');
            notifications.push({
                icon: "⚠️",
                color: "#E11D48",
                title: `Review Missed Concept: ${formattedTitle}`,
                message: `You previously missed questions on "${formattedTitle}" while studying "${topic}". Reviewing this concept within 24 hours boosts retention by up to 80%.`,
                btnText: "🔄 Review Concept Now",
                action: `triggerReexplanation('${tag}')`
            });
        });
    } else {
        notifications.push({
            icon: "✨",
            color: "var(--primary-blue)",
            title: "Study Schedule Optimized",
            message: "No urgent conceptual weak points detected. Keep advancing through your schedule or explore new topics in AI Practice.",
            btnText: "📖 Go to Practice",
            action: "navigateTo('practice')"
        });
    }

    // XP / Level progress reminder
    const xpNeeded = (profile.xp_next_level || 200) - (profile.xp || 0);
    notifications.push({
        icon: "🏆",
        color: "#F59E0B",
        title: `Level Up Horizon — ${xpNeeded} XP Needed`,
        message: `You are currently Level ${profile.level || 1} with ${profile.xp || 0} XP. Earn ${xpNeeded > 0 ? xpNeeded : 50} more XP to reach Level ${(profile.level || 1) + 1}!`,
        btnText: "📝 Earn XP Now",
        action: "navigateTo('practice')"
    });

    container.innerHTML = notifications.map(notif => `
        <div style="background: var(--white); border-left: 4px solid ${notif.color}; border-radius: 8px; padding: 18px 22px; border-top: 1px solid #E5E7EB; border-right: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <div style="display: flex; gap: 15px; align-items: flex-start; max-width: 68%;">
                <span style="font-size: 1.8rem; line-height: 1.2;">${notif.icon}</span>
                <div>
                    <h4 style="font-size: 1.08rem; color: var(--text-charcoal-dark); margin: 0 0 6px 0;">${notif.title}</h4>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0; line-height: 1.45;">${notif.message}</p>
                </div>
            </div>
            <div>
                <button class="action-trigger-btn primary-intent" style="padding: 10px 16px; font-size: 0.85rem; margin: 0;" onclick="${notif.action}">${notif.btnText}</button>
            </div>
        </div>
    `).join('');
}

function initNavigationRouter() {
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.dataset.target;
            navigateTo(target);
        });
    });
}

// ============================================
// FILE UPLOAD & DRAG AND DROP
// ============================================

function setupGlobalDragDrop() {
    // Prevent browser default behavior (opening PDF/image in new tab) globally across window
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, false);

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer ? e.dataTransfer.files : null;
        if (files && files.length > 0) {
            handleFileUpload({ target: { files: [files[0]], value: '' } });
        }
    }, false);
}

async function handleDragDropUpload(e) {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer ? e.dataTransfer.files : null;
    if (files && files.length > 0) {
        await handleFileUpload({ target: { files: [files[0]], value: '' } });
    }
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Immediately switch to Practice view so user sees loading & explanation
    navigateTo('practice');

    const labelEl = document.getElementById('attachment-label');
    const originalLabel = labelEl ? labelEl.innerText : "";
    if (labelEl) labelEl.innerHTML = '<span class="loading-spinner"></span> Extracting text...';

    if (isMockMode()) {
        const mockExtracted = "Simulated extracted content from uploaded document: " + file.name + "\n\nThis document discusses fundamental concepts in Applied Physics and Computer Science, including energy band gaps, microcontrollers, and neural network algorithms.";
        if (labelEl) labelEl.innerText = originalLabel;
        e.target.value = ''; // Reset input so same file can be chosen again
        
        // Put reference in topic input and trigger AI explanation directly
        document.getElementById('topic-input').value = `Uploaded File: ${file.name}`;
        await triggerExplanationFromText(mockExtracted, `Uploaded Document: ${file.name}`);
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    // Determine endpoint based on file type
    const ext = file.name.split('.').pop().toLowerCase();
    const imageExtensions = ['png', 'jpg', 'jpeg', 'webp'];
    const endpoint = imageExtensions.includes(ext) ? '/upload-image' : '/upload-material';

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            console.error("Backend Error Details:", errData);
            alert(`Upload failed (${res.status}): ${errData.detail || "Could not extract text from this file."}`);
            if (labelEl) labelEl.innerText = originalLabel;
            e.target.value = '';
            return;
        }

        const data = await res.json();
        if (labelEl) labelEl.innerText = originalLabel;
        e.target.value = ''; // Reset input so same file can be chosen again

        if (!data.extracted_text || !data.extracted_text.trim()) {
            return alert("We couldn't detect any clear text in that document. Please ensure the image/PDF is legible.");
        }

        // Put reference in search input so user sees what topic is being studied
        document.getElementById('topic-input').value = `Uploaded File: ${data.filename || file.name}`;

        // Automatically send the extracted text to the AI for deep/cram analysis and breakdown
        navigateTo('practice');
        await triggerExplanationFromText(data.extracted_text, `Uploaded Document: ${data.filename || file.name}`);

    } catch (err) {
        console.error("Fetch Error:", err);
        alert("Upload failed. Check that the backend server is running locally (uvicorn main:app --reload --port 8000).");
        if (labelEl) labelEl.innerText = originalLabel;
        e.target.value = '';
    }
}

// ============================================
// MISSING UTILITY FUNCTIONS
// ============================================

function updateMockStatusDisplay(isChecked) {
    const statusText = document.getElementById('settings-mock-status-text');
    if (statusText) {
        statusText.innerText = isChecked ? 'Simulated (Mock) Mode' : 'Live Backend Mode';
    }
    refreshProfile();
}

function resetUserData() {
    if (!confirm("Are you sure you want to reset all progress, timetable, and assignments to defaults?")) return;
    
    // Reset timetable
    userTimetable = [
        { id: 1, day: "Mon", tag: "physics", subject: "Quantum Mechanics Core Review" },
        { id: 2, day: "Wed", tag: "electronics", subject: "Embedded Microcontrollers Lab" },
        { id: 3, day: "Fri", tag: "cs", subject: "FastAPI Production API Design" }
    ];
    
    // Reset assignments
    userAssignments = [
        { id: 1, title: "Refine Real-time Environmental Data Schemas", due: "2 Days", tracking: "Tech Startup Architecture" }
    ];
    
    // Reset activity heatmap
    systemActivityLog = {};
    
    // Persist to localStorage
    localStorage.setItem('timetable', JSON.stringify(userTimetable));
    localStorage.setItem('assignments', JSON.stringify(userAssignments));
    localStorage.setItem('activityLog', JSON.stringify(systemActivityLog));
    
    // Re-render
    renderTimetable(userTimetable);
    renderAssignments(userAssignments);
    buildActivityHeatmap();
    
    // Reset mock profile
    if (window.mockData && window.mockData.profile) {
        window.mockData.profile.xp = 0;
        window.mockData.profile.level = 1;
        window.mockData.profile.streak = 1;
        window.mockData.profile.weak_points = [];
    }
    
    refreshProfile();
    alert("✅ All data has been reset to defaults.");
}

// ============================================
// BOOT
// ============================================

window.onload = initDashboard;