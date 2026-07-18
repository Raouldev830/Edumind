const API_BASE = "http://127.0.0.1:8000";
let activeQuizPayload = null;
let currentExtractedText = "";

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

function isMockMode() {
    return document.getElementById('debug-toggle')?.checked || false;
}

let userTimetable = JSON.parse(localStorage.getItem('timetable')) || [
    { id: 1, day: "Mon", tag: "physics", subject: "Quantum Mechanics Core Review" },
    { id: 2, day: "Wed", tag: "electronics", subject: "Embedded Microcontrollers Lab" },
    { id: 3, day: "Fri", tag: "cs", subject: "FastAPI Production API Design" }
];

let userAssignments = JSON.parse(localStorage.getItem('assignments')) || [
    { id: 1, title: "Refine Real-time Environmental Data Schemas", due: "2 Days", tracking: "Tech Startup Architecture" }
];

let systemActivityLog = JSON.parse(localStorage.getItem('activityLog')) || {};

async function initDashboard() {
    initNavigationRouter();
    renderTimetable(userTimetable);
    renderAssignments(userAssignments);
    buildActivityHeatmap();
    
    // Core Button Listeners
    document.getElementById('generate-btn')?.addEventListener('click', triggerExplanation);
    document.getElementById('generate-quiz-btn')?.addEventListener('click', triggerQuizGeneration);
    document.getElementById('submit-quiz-btn')?.addEventListener('click', triggerEvaluation);
    document.getElementById('add-schedule-btn')?.addEventListener('click', addScheduleSlot);
    
    // File Upload Listener
    document.getElementById('file-input')?.addEventListener('change', handleFileUpload);
    document.getElementById('upload-zone')?.addEventListener('click', () => document.getElementById('file-input').click());

    // Profile Load
    const defaultProfile = {username: "SP", level: 1, streak: 1, xp: 0};
    if (isMockMode()) {
        renderProfile(window.mockData?.profile || defaultProfile);
    } else {
        try {
            const res = await fetch(`${API_BASE}/profile/StudentPro`);
            const data = await res.json();
            renderProfile(data);
        } catch (err) {
            renderProfile(defaultProfile);
        }
    }
}

function addScheduleSlot() {
    const day = document.getElementById('schedule-day').value;
    const tag = document.getElementById('schedule-tag').value;
    const subject = document.getElementById('schedule-subject').value;
    if (!subject) return alert("Enter a subject.");
    userTimetable.push({ id: Date.now(), day, tag, subject });
    saveAndSync();
    document.getElementById('schedule-subject').value = "";
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    // Ensure this "file" string matches your backend's parameter name
    formData.append("file", file); 

    try {
        const res = await fetch(`${API_BASE}/upload-material`, { 
            method: 'POST', 
            body: formData 
            // Note: Do NOT set 'Content-Type': 'multipart/form-data' manually.
            // The browser sets it automatically with the boundary, and 
            // setting it manually will cause a 422 error.
        });
        
        if (!res.ok) {
            const errData = await res.json();
            console.error("Backend Error Details:", errData);
            alert("Upload failed: Check console for details.");
        } else {
            alert("File processed successfully!");
        }
    } catch (err) { 
        console.error("Fetch Error:", err);
    }
}

function initNavigationRouter() {
    const menuItems = document.querySelectorAll(".sidebar-menu .menu-item");
    const dashboardView = document.getElementById("view-dashboard");
    // Updated to match logic
    menuItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            menuItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");
        });
    });
}

function renderProfile(data) {
    document.getElementById('ui-username').innerText = data.username.substring(0, 2).toUpperCase();
    document.getElementById('ui-level').innerText = data.level;
    document.getElementById('ui-streak').innerText = `🔥 ${data.streak} Day Streak`;
    const nextLevelXP = data.xp_next_level || 200;
    document.getElementById('ui-xp-text').innerText = `${data.xp} / ${nextLevelXP} XP`;
    document.getElementById('ui-xp-bar').style.width = `${Math.min((data.xp / nextLevelXP) * 100, 100)}%`;
}

function buildActivityHeatmap() {
    const grid = document.getElementById('github-heatmap');
    if (!grid) return;
    grid.innerHTML = "";
    for (let i = 0; i < 189; i++) {
        const cell = document.createElement('div');
        cell.className = `heatmap-cell ${systemActivityLog[i] ? 'level-' + systemActivityLog[i] : ''}`;
        grid.appendChild(cell);
    }
}

function renderTimetable(list) {
    const box = document.getElementById('timetable-container');
    if (!box) return;
    box.innerHTML = list.map(item => `
        <div class="notion-item-row">
            <div><span class="day-tag">${item.day}</span> <span class="field-pill pill-${item.tag}">${item.tag.toUpperCase()}</span> ${item.subject}</div>
            <button class="delete-btn" onclick="deleteTimetableSlot(${item.id})">❌</button>
        </div>`).join('');
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

async function triggerExplanation() {
    const topic = document.getElementById('topic-input').value.trim();
    if (!topic) return alert("Enter a concept.");
    const genBtn = document.getElementById('generate-btn');
    genBtn.innerText = "⏳ Processing...";
    try {
        const outputData = isMockMode() ? window.mockData.explanation : await (await fetch(`${API_BASE}/explain`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({topic, username: "StudentPro"})
        })).json();
        document.getElementById('explanation-box').innerText = outputData.explanation;
        currentExtractedText = outputData.explanation;
        document.getElementById('explanation-card').style.display = "block";
    } catch (e) { alert("Server error."); }
    genBtn.innerText = "Generate Insights";
}

async function triggerQuizGeneration() {
    const quizData = isMockMode() ? window.mockData.quiz : await (await fetch(`${API_BASE}/quiz`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({context_text: currentExtractedText})
    })).json();
    activeQuizPayload = quizData.questions;
    const form = document.getElementById('quiz-form');
    form.innerHTML = activeQuizPayload.map(q => `
        <div><p>${q.question}</p>
        ${Object.entries(q.options).map(([k, v]) => `<label><input type="radio" name="q-${q.id}" value="${k}"> ${k}: ${v}</label>`).join('')}
        </div>`).join('');
    document.getElementById('quiz-card').style.display = "block";
}

async function triggerEvaluation() { alert("Evaluation triggered!"); }

window.onload = initDashboard;