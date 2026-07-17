/**
 * MOCK DATA — matches the exact JSON shapes defined in backend/schemas.py
 *
 * Person B: build the entire UI against these mock objects first.
 * Once the backend is live, swap the mock functions in script.js for
 * real fetch() calls to http://localhost:8000/... — the JSON shape
 * will not change, so no UI rework should be needed.
 */

const MOCK_EXPLAIN_RESPONSE = {
  explanation: "Newton's second law states that force equals mass times acceleration (F = ma). " +
               "This means the more mass an object has, the more force is needed to accelerate it.",
  level: "intermediate"
};

const MOCK_QUIZ_RESPONSE = {
  questions: [
    {
      question: "What does F = ma represent?",
      options: ["Force equals mass times acceleration", "Force equals mass divided by acceleration",
                "Mass equals force times acceleration", "Acceleration equals force times mass"],
      answer: "Force equals mass times acceleration",
      concept_tag: "newtons_second_law_formula"
    },
    {
      question: "If mass increases and force stays constant, what happens to acceleration?",
      options: ["It increases", "It decreases", "It stays the same", "It becomes zero"],
      answer: "It decreases",
      concept_tag: "inverse_mass_acceleration_relationship"
    }
  ]
};

const MOCK_EVALUATE_RESPONSE = {
  score: 1,
  total: 2,
  missed_concepts: [
    { concept_tag: "inverse_mass_acceleration_relationship",
      question: "If mass increases and force stays constant, what happens to acceleration?" }
  ]
};

const MOCK_REEXPLAIN_RESPONSE = {
  explanation: "Think of it like pushing a shopping cart. An empty cart (low mass) speeds up fast " +
               "with a small push. A cart full of groceries (high mass) needs the same push just to " +
               "get the same result slower — same force, more mass, less acceleration."
};
