// MindLoop frontend logic
// Currently wired to mock-data.js. Swap USE_MOCK to false and fill in
// the fetch() calls once the backend is running locally.

const USE_MOCK = true;
const API_BASE = "http://localhost:8000";

const explainBtn = document.getElementById("explain-btn");
const quizBtn = document.getElementById("quiz-btn");
const submitQuizBtn = document.getElementById("submit-quiz-btn");

let currentQuiz = null;
let currentContent = null;

explainBtn.addEventListener("click", async () => {
  currentContent = document.getElementById("content-input").value;

  let data;
  if (USE_MOCK) {
    data = MOCK_EXPLAIN_RESPONSE;
  } else {
    // TODO: replace with real call
    // const res = await fetch(`${API_BASE}/explain`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ content: currentContent, weak_points: [] })
    // });
    // data = await res.json();
  }

  document.getElementById("explanation-text").textContent = data.explanation;
  document.getElementById("explanation-section").classList.remove("hidden");
});

quizBtn.addEventListener("click", async () => {
  let data;
  if (USE_MOCK) {
    data = MOCK_QUIZ_RESPONSE;
  } else {
    // TODO: replace with real call to /quiz
  }

  currentQuiz = data.questions;
  renderQuiz(currentQuiz);
  document.getElementById("quiz-section").classList.remove("hidden");
});

function renderQuiz(questions) {
  const container = document.getElementById("quiz-questions");
  container.innerHTML = "";
  questions.forEach((q, i) => {
    const block = document.createElement("div");
    block.className = "quiz-question";
    block.innerHTML = `
      <p>${q.question}</p>
      ${q.options.map(opt => `
        <label>
          <input type="radio" name="q${i}" value="${opt}" data-concept="${q.concept_tag}" data-question="${q.question}">
          ${opt}
        </label>
      `).join("")}
    `;
    container.appendChild(block);
  });
}

submitQuizBtn.addEventListener("click", async () => {
  const answers = [];
  currentQuiz.forEach((q, i) => {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);
    if (selected) {
      answers.push({
        question: selected.dataset.question,
        selected: selected.value,
        concept_tag: selected.dataset.concept
      });
    }
  });

  let data;
  if (USE_MOCK) {
    data = MOCK_EVALUATE_RESPONSE;
  } else {
    // TODO: replace with real call to /evaluate, sending answers + currentQuiz as correct_answers
  }

  document.getElementById("score-text").textContent = `Score: ${data.score}/${data.total}`;
  document.getElementById("results-section").classList.remove("hidden");

  const reexplainArea = document.getElementById("reexplain-area");
  reexplainArea.innerHTML = "";
  for (const missed of data.missed_concepts) {
    let reexplainData;
    if (USE_MOCK) {
      reexplainData = MOCK_REEXPLAIN_RESPONSE;
    } else {
      // TODO: replace with real call to /reexplain
    }
    const p = document.createElement("p");
    p.textContent = `Re-explaining "${missed.concept_tag}": ${reexplainData.explanation}`;
    reexplainArea.appendChild(p);
  }
});
