// mock-data.js — Complete mock response shapes for all API endpoints
window.mockData = {
    profile: {
        username: "StudentPro",
        level: 2,
        streak: 5,
        xp: 120,
        xp_next_level: 400,
        weak_points: [
            {
                concept_tag: "vanishing_gradients",
                topic: "Understanding Neural Network Backpropagation",
                times_missed: 2,
                created_at: "2026-07-20T14:30:00Z"
            },
            {
                concept_tag: "chain_rule_gradients",
                topic: "Understanding Neural Network Backpropagation",
                times_missed: 1,
                created_at: "2026-07-20T15:00:00Z"
            },
            {
                concept_tag: "asymptotic_notation",
                topic: "Algorithm Analysis & Big-O Notation",
                times_missed: 3,
                created_at: "2026-07-19T10:00:00Z"
            }
        ]
    },
    explanation: {
        title: "Understanding Neural Network Backpropagation",
        explanation: "Backpropagation is the fundamental algorithm that allows neural networks to learn from their mistakes.\n\n1. FORWARD PASS: Input data flows through the network layer by layer. Each neuron computes a weighted sum of its inputs, applies an activation function, and passes the result forward. At the end, the network produces a prediction.\n\n2. LOSS CALCULATION: The network's output is compared against the expected result using a loss function (e.g., MSE or Cross-Entropy). This produces a single number representing how wrong the prediction was.\n\n3. BACKWARD PASS: The gradient of the loss is computed with respect to each weight in the network, starting from the output layer and moving backward. This uses the chain rule of calculus to decompose the total error into contributions from each weight.\n\n4. WEIGHT UPDATE: Using gradient descent, each weight is nudged in the direction that reduces the loss. The learning rate controls how big each step is — too large causes overshooting, too small causes slow convergence.",
        key_takeaways: [
            "Backpropagation uses the chain rule of calculus to compute gradients",
            "The learning rate controls how large each weight update step is",
            "Vanishing gradients can occur in deep networks with certain activation functions",
            "Mini-batch gradient descent balances speed and stability"
        ],
        gamification: {
            xp_earned: 25,
            new_total_xp: 145,
            current_level: 2,
            current_streak: 5,
            level_up_occurred: false
        }
    },
    quiz: {
        questions: [
            {
                id: 1,
                question: "What mathematical principle does backpropagation rely on to compute gradients through multiple layers?",
                options: {
                    A: "The Pythagorean theorem",
                    B: "The chain rule of calculus",
                    C: "Bayes' theorem",
                    D: "The central limit theorem"
                },
                correct_answer: "B",
                concept_tag: "chain_rule_gradients"
            },
            {
                id: 2,
                question: "What problem can occur in deep networks when using sigmoid activation functions during backpropagation?",
                options: {
                    A: "Exploding memory usage",
                    B: "Infinite loop recursion",
                    C: "Vanishing gradients",
                    D: "Data type overflow"
                },
                correct_answer: "C",
                concept_tag: "vanishing_gradients"
            },
            {
                id: 3,
                question: "What does the learning rate parameter control during weight updates?",
                options: {
                    A: "The number of training epochs",
                    B: "The size of each weight adjustment step",
                    C: "The batch size for data loading",
                    D: "The number of hidden layers"
                },
                correct_answer: "B",
                concept_tag: "learning_rate"
            },
            {
                id: 4,
                question: "In backpropagation, what is the purpose of the forward pass?",
                options: {
                    A: "To update all network weights simultaneously",
                    B: "To compute the network's prediction given current weights",
                    C: "To shuffle the training data randomly",
                    D: "To prune unnecessary neurons"
                },
                correct_answer: "B",
                concept_tag: "forward_pass"
            }
        ]
    },
    evaluation: {
        score: 3,
        total_questions: 4,
        passed: true,
        weak_points: ["vanishing_gradients"],
        feedback: "Strong performance overall! You clearly understand the chain rule and forward pass mechanics. However, you confused vanishing gradients with exploding memory — review how sigmoid squashes gradients in deep layers.",
        gamification: {
            xp_earned: 75,
            new_total_xp: 220,
            current_level: 2,
            current_streak: 5,
            level_up_occurred: false
        }
    },
    reexplanation: {
        title: "Vanishing Gradients — A Different Angle",
        re_explanation: "Think of it like a game of telephone. In a deep network, the gradient signal has to travel backward through many layers. Each layer multiplies it by the derivative of its activation function.\n\nWith sigmoid: the derivative is always between 0 and 0.25. Multiply a number by 0.25 ten times in a row and it becomes incredibly tiny — effectively zero.\n\nThat's the vanishing gradient problem: by the time the error signal reaches the early layers, it's so small that those layers barely learn anything.\n\nSolution: Use ReLU (derivative is either 0 or 1) or residual connections (skip connections that let the gradient flow directly).",
        reassurance: "This is one of the trickiest concepts in deep learning — the fact that you got the other 3 right shows you understand the fundamentals. This one piece will click with practice! 🎯"
    }
};