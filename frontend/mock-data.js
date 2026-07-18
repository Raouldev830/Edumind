// mock-data.js
window.mockData = {
    profile: {
        username: "StudentPro",
        level: 2,
        streak: 5,
        xp: 120,
        xp_next_level: 200
    },
    explanation: {
        explanation: "Concept Analysis: FastAPI Engine Architecture & Hardware Telemetry Synchronization\n\n" +
                     "1. ASYNCHRONOUS PIPELINES: FastAPI utilizes Python's ASGI (Asynchronous Server Gateway Interface) standard, leveraging async/await design patterns to handle high-concurrency connections without blocking the main execution thread. This is critical when receiving parallel sensor logs from hardware telemetry arrays.\n\n" +
                     "2. EMBEDDED SYSTEM COUPLING: When microcontrollers stream data points over WebSockets, the backend pushes data frames straight into an in-memory database layout (like SQLite or Redis). This minimizes write latency and avoids traditional I/O bottlenecks.\n\n" +
                     "3. QUANTUM STATE SIMULATION CONSIDERATIONS: When scaling mathematical or hardware processing vectors, ensuring data integrity across real-time sockets allows dashboards to maintain deterministic state representations.",
        gamification: {
            xp_earned: 50,
            current_level: 2,
            current_streak: 5
        }
    },
    quiz: {
        questions: [
            {
                id: 101,
                question: "Which architectural element enables FastAPI to manage non-blocking concurrent connections?",
                options: {
                    A: "Synchronous WSGI thread pooling",
                    B: "Asynchronous ASGI loop implementation",
                    C: "Traditional multi-process branching model",
                    D: "Hardware-level clock cycle interrupts"
                },
                correct_answer: "B"
            },
            {
                id: 102,
                question: "What is the primary technical advantage of utilizing WebSockets over normal standard HTTP requests for hardware drone logging?",
                options: {
                    A: "Bidirectional persistent streaming containing significantly lower overhead protocol headers",
                    B: "Enhanced safety algorithms optimized strictly for hardware data caching",
                    C: "Forced synchronous execution pathways on embedded microcontrollers",
                    D: "Automatic database compilation and optimization steps"
                },
                correct_answer: "A"
            },
            {
                id: 103,
                question: "How should a real-time dashboard structure data processing layers to maintain smooth 60 FPS visual state updates?",
                options: {
                    A: "Execute heavy array sorting routines on the primary UI thread repeatedly",
                    B: "Batch coming telemetry arrays into non-blocking frame buffers and use virtual lists",
                    C: "Force full browser window reloads on every single arriving data packet",
                    D: "Convert all metric assets into raw video layers dynamically on the fly"
                },
                correct_answer: "B"
            }
        ]
    }
};