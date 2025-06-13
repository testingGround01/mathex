/*
--------------------------------------------------------------------------
IMPORTANT NOTE ON DATA STORAGE
--------------------------------------------------------------------------
This application uses the browser's `localStorage` to save user progress.
This data is stored securely within your browser for this specific website.
It does NOT create any physical files on your computer's filesystem (like
in the same folder as this index.html file). This is the standard, modern
approach for web applications to remember user data without requiring a server
or user accounts. The data persists even if you close the tab or browser.
--------------------------------------------------------------------------
*/

/* ---------------------------------------
   GLOBAL VARIABLES & STATE TRACKING
---------------------------------------- */
let currentMode = 'light'; // 'light' or 'dark'
let sessionActive = false;
let sessionStartTime = 0;
let sessionEndTime = 0;
let questionIndex = 0; // Current question number (1-based for display)
let correctCount = 0;
let incorrectCount = 0;
let skippedCount = 0;
let totalQuestionsTarget = 0; // For 'Fixed Questions' mode
let sessionDurationTarget = 0; // For 'Fixed Time' modes (in seconds)
let sessionTimerId = null;
let remainingTime = 0; // For 'Fixed Time' modes (in seconds)
let questionStartTime = 0; // Timestamp when the current question was shown
let currentSessionSettings = null; // Holds settings for the current session
let sessionDetails = []; // Array to store details of each question answered
let currentQuestion = null; // The currently displayed question object {text, answer, type, difficulty}
let isAutoSubmitting = false; // Flag to prevent double submission on auto-submit
let currentArea = 'practice-area'; // Track the currently visible area

// Difficulty levels order
const difficultyLevels = ['easy', 'medium', 'hard', 'expert'];
const questionTypes = ['multiplication', 'squares', 'cubes', 'sqrt', 'cbrt', 'fractions'];
let isAdaptiveMode = false;
let adaptiveDifficultyLevel = 'easy'; // Current difficulty in adaptive/challenge modes
let consecutiveCorrectAnswers = 0; // Counter for adaptive/challenge progression
let consecutiveIncorrectAnswers = 0; // NEW: Counter for adaptive decrease trigger
let adaptiveIncreaseThreshold = 5; // Correct answers needed to level up in Adaptive
const ADAPTIVE_DECREASE_THRESHOLD = 2; // NEW: Consecutive incorrect needed to decrease difficulty

let isChallengeMode = false;
let challengeScore = 0;
const challengeTimeBonuses = { easy: 0.5, medium: 1, hard: 1.5, expert: 2 }; // Seconds added per correct answer
const challengeDifficultyIncreaseThreshold = 3; // Correct answers needed to level up in Challenge

// Streak tracking variables
let currentStreak = 0;
let maxStreak = 0;

// DOM Element References (GLOBAL)
const body = document.body;
const pageTab = document.querySelector('.page-tab');
const pageTitleEl = document.getElementById('pageTitle');
const practiceArea = document.getElementById('practice-area');
const studyArea = document.getElementById('study-area');
const dashboardArea = document.getElementById('dashboard-area');
const mainCard = document.getElementById('mainCard');
const sessionCard = document.getElementById('sessionCard');
const resultCard = document.getElementById('resultCard');
const progressBar = document.getElementById('progressBar');
const progressBarContainer = document.querySelector('.progress-container');
const statusIndicator = document.getElementById('statusIndicator');
const sessionQuestionEl = document.getElementById('sessionQuestion');
const sessionAnswerInput = document.getElementById('sessionAnswer');
const timeGraphContainer = document.getElementById('timeGraph');
const detailTableBody = document.getElementById('detailTableBody');
const mobileDetailContainer = document.getElementById('mobileDetailContainer');
const themeToggleButton = document.getElementById('themeToggle');
const challengeScoreContainer = document.getElementById('challengeScoreContainer');
const challengeScoreNumber = document.getElementById('challengeScoreNumber');
const infoContainer = document.getElementById('info-container');
const infoButton = document.getElementById('info-button');
const infoTooltip = document.getElementById('info-tooltip');
const infoModalOverlay = document.getElementById('info-modal-overlay');
const infoModalCard = document.getElementById('info-modal-card');
const infoModalCloseBtn = document.getElementById('info-modal-close');
const s3AdaptiveInput = document.getElementById('s3-adaptiveInput');
const s3InputLabel = document.getElementById('s3-input-label');
const subFqButton = document.getElementById('sub-fq');
const subFtButton = document.getElementById('sub-ft');
const streakNumberEl = document.getElementById('streakNumber');
const totalTimeNumberEl = document.getElementById('totalTimeNumber');
const graphTooltipEl = document.getElementById('graphTooltip');
const summaryPieChartContainer = document.getElementById('summaryPieChartContainer');
const summaryPieChartLegend = document.getElementById('summaryPieChartLegend');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mainNav = document.getElementById('main-nav');
const navLinks = mainNav?.querySelectorAll('.nav-list a[data-area]') || []; // Get area links
const backToTopBtnGlobal = document.getElementById('back-to-top-btn'); // Global Back to Top Button

// Targeted Practice elements
const s5TargetTypeRadios = document.querySelectorAll('input[name="s5-target-type"]');
const s5LimitTypeRadios = document.querySelectorAll('input[name="s5-limit-type"]');
const s5TargetInputContainers = {
    multiplicationTable: document.getElementById('s5-input-multiplicationTable'),
    squareRange: document.getElementById('s5-input-squareRange'),
    cubeRange: document.getElementById('s5-input-cubeRange')
};
const s5LimitValueInput = document.getElementById('s5-limitValue');
const s5LimitLabel = document.getElementById('s5-limit-label');

// NEW: Review Area DOM Element References
const reviewArea = document.getElementById('review-area');
const reviewListCard = document.getElementById('reviewListCard');
const sessionListContainer = document.getElementById('session-list-container');
const reviewDetailCard = document.getElementById('reviewDetailCard');


/* ---------------------------------------
   ADVANCED USER PROFILE MANAGEMENT
---------------------------------------- */

/**
 * UserProfile class to manage all user data, including stats, history, and mastery.
 * This encapsulates all data logic, making the main script cleaner.
 */
class UserProfile {
    constructor(data = {}) {
        this.schemaVersion = data.schemaVersion || 3; // UPDATED: Schema version for full session storage
        this.profile = {
            creationDate: data.profile?.creationDate || new Date().toISOString(),
            lastSeenDate: data.profile?.lastSeenDate || new Date().toISOString()
        };
        this.globalStats = {
            totalSessions: 0,
            totalTimePracticed: 0,
            allTimeBestStreak: 0,
            totalQuestionsAnswered: 0,
            ...data.globalStats
        };
        // UPDATED: sessionHistory now stores the full session object
        this.sessionHistory = data.sessionHistory || [];
        this.detailedPerformance = data.detailedPerformance || {};
        this.nextReviewSchedule = data.nextReviewSchedule || {};
    }

    /**
     * Processes the results of a completed session and updates the user profile.
     * @param {{sessionId: string, startTime: number, endTime: number, maxStreak: number, settings: object, details: Array<object>, summary: object}} sessionData
     */
    endSession(sessionData) {
        const { endTime, startTime, maxStreak, details } = sessionData;
        this.globalStats.totalSessions++;
        const durationMs = endTime - startTime;
        this.globalStats.totalTimePracticed += durationMs;
        this.globalStats.allTimeBestStreak = Math.max(this.globalStats.allTimeBestStreak, maxStreak);
        this.profile.lastSeenDate = new Date().toISOString();

        // Record full session history
        this.sessionHistory.unshift(sessionData); // Add to the beginning (for reverse chrono order)
        if (this.sessionHistory.length > 100) this.sessionHistory.pop(); // Keep history manageable

        // Update per-question stats and mastery
        details.forEach(d => this._updateDetail(d));

        // Schedule next review based on performance in this session
        this._scheduleNextReview(details);

        // Persist the entire updated profile
        saveUserPerformance(this);
    }

    _updateDetail({ type, difficulty, status, timeMs, userAnswer, questionText, correctAnswer }) {
        if (difficulty === 'targeted') return; // Do not track targeted practice in long-term stats

        this.globalStats.totalQuestionsAnswered++;

        // Ensure the data structure path exists
        this.detailedPerformance[type] ??= {};
        const bucket = (this.detailedPerformance[type][difficulty] ??= {
            correct: 0,
            incorrect: 0,
            skipped: 0,
            totalAttempts: 0,
            totalTimeCorrect: 0,
            totalTimeIncorrect: 0,
            errorLog: [],
            mastery: 0
        });

        bucket.totalAttempts++;
        if (status === 'correct') {
            bucket.correct++;
            bucket.totalTimeCorrect += timeMs;
        } else if (status === 'incorrect') {
            bucket.incorrect++;
            bucket.totalTimeIncorrect += timeMs;
            bucket.errorLog.push({ q: questionText, ans: correctAnswer, userAns: userAnswer, time: new Date().toISOString() });
            if (bucket.errorLog.length > 20) bucket.errorLog.shift(); // Keep error log manageable
        } else {
            bucket.skipped++;
        }
        // Update mastery after every attempt
        bucket.mastery = this._calculateMastery(bucket);
    }

    _calculateMastery(bucket) {
        // A simple mastery score: ratio of correct answers to total attempts.
        // Could be evolved into an exponential moving average for more recent performance weighting.
        if (bucket.totalAttempts === 0) return 0;
        return bucket.correct / bucket.totalAttempts;
    }

    _scheduleNextReview(details) {
        // Spaced Repetition System (SRS)
        details
            .filter(d => d.status !== 'skipped' && d.difficulty !== 'targeted')
            .forEach(({ type, difficulty }) => {
                const mastery = this.detailedPerformance[type]?.[difficulty]?.mastery ?? 0;
                // Spaced repetition intervals in days: [1, 3, 7, 14, 30]
                // The lower the mastery, the sooner the review.
                let intervalDays;
                if (mastery < 0.4) intervalDays = 1;
                else if (mastery < 0.7) intervalDays = 3;
                else if (mastery < 0.9) intervalDays = 7;
                else if (mastery < 1) intervalDays = 14;
                else intervalDays = 30; // Fully mastered

                this.nextReviewSchedule[type] ??= {};
                this.nextReviewSchedule[type][difficulty] = new Date(Date.now() + intervalDays * 24 * 3600 * 1000).toISOString();
            });
    }
}


/**
 * Retrieves the user's performance data from localStorage and returns a UserProfile instance.
 * @returns {UserProfile} An instance of the UserProfile class.
 */
function loadUserPerformance() {
  try {
    const data = localStorage.getItem('mathexUserProfile_v3'); // Using a new key for the new structure
    if (data) {
      const parsedData = JSON.parse(data);
      if (parsedData.schemaVersion === 3) {
         return new UserProfile(parsedData);
      }
    }
  } catch (error) {
    console.error("Error parsing user profile from localStorage:", error);
    localStorage.removeItem('mathexUserProfile_v3');
  }
  // Return a new, empty profile if nothing is found or an error occurs.
  return new UserProfile();
}

/**
 * Saves the UserProfile instance's data to localStorage.
 * @param {UserProfile} profile The UserProfile instance to save.
 */
function saveUserPerformance(profile) {
  try {
    // We stringify the profile instance, which serializes its data properties.
    localStorage.setItem('mathexUserProfile_v3', JSON.stringify(profile));
  } catch (error) {
    console.error("Error saving user profile to localStorage:", error);
  }
}


/* ---------------------------------------
   HELPER FUNCTIONS
---------------------------------------- */
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Parse a comma-separated list of numbers or ranges (e.g., "2,4-6")
function parseNumberList(str) {
    if (!str || typeof str !== 'string') return [];
    const values = [];
    str.split(',').forEach(part => {
        const item = part.trim();
        if (!item) return;
        if (item.includes('-')) {
            const [start, end] = item.split('-').map(n => parseInt(n, 10));
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let i = start; i <= end; i++) values.push(i);
            }
        } else {
            const num = parseInt(item, 10);
            if (!isNaN(num)) values.push(num);
        }
    });
    return values.filter(n => n >= 1);
}

function formatDecimalAnswer(num) {
    if (typeof num !== 'number' || isNaN(num)) {
        return '0.000';
    }
    let fixedNum = num.toFixed(3);
    let parts = fixedNum.split('.');
    if (parts.length === 1) {
        fixedNum += '.000';
    } else if (parts[1].length < 3) {
        fixedNum += '0'.repeat(3 - parts[1].length);
    }
    return fixedNum;
}

function formatTime(ms, showDecimals = true) {
    if (ms === null || typeof ms !== 'number' || isNaN(ms) || ms < 0) return showDecimals ? '0.00s' : '0s';
    if (showDecimals && ms < 60000) { // Only show decimals for times under a minute
         return `${(ms / 1000).toFixed(2)}s`;
    } else {
        const totalSeconds = Math.round(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
             return `${seconds}s`;
        }
    }
}

 function formatBigNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return num.toLocaleString();
}

function sanitizeHTML(str) {
    if (!str) return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

function updateTargetedInputs() {
    if (!practiceArea.contains(document.querySelector('input[name="s5-target-type"]'))) return; // Only run if in practice area
    const selectedType = document.querySelector('#practice-area input[name="s5-target-type"]:checked')?.value;
    Object.values(s5TargetInputContainers).forEach(container => {
        if (container) container.style.display = 'none';
    });
    if (selectedType && s5TargetInputContainers[selectedType]) {
        s5TargetInputContainers[selectedType].style.display = 'block';
         const firstInput = s5TargetInputContainers[selectedType].querySelector('input');
         if(firstInput && document.activeElement !== firstInput) firstInput.focus();
    }
}

function updateTargetedLimitInput() {
    if (!practiceArea.contains(document.querySelector('input[name="s5-limit-type"]'))) return; // Only run if in practice area
    const selectedLimit = document.querySelector('#practice-area input[name="s5-limit-type"]:checked')?.value;
    if (selectedLimit === 'questions') {
        s5LimitValueInput.placeholder = 'Number of Questions (e.g., 10)';
        s5LimitValueInput.min = '1';
        s5LimitLabel.textContent = 'Number of Questions';
        s5LimitValueInput.value = s5LimitValueInput.value || '10';
    } else if (selectedLimit === 'time') {
        s5LimitValueInput.placeholder = 'Time Duration (seconds, e.g., 60)';
        s5LimitValueInput.min = '10';
        s5LimitLabel.textContent = 'Time Duration (seconds)';
        s5LimitValueInput.value = s5LimitValueInput.value || '60';
    }
     if(document.activeElement !== s5LimitValueInput) s5LimitValueInput.focus();
}

function checkAnswerCorrectness(userAnswerRaw, question) {
    if (!question || typeof userAnswerRaw !== 'string') {
         console.warn("Invalid input to checkAnswerCorrectness");
         return false;
    }
    const correctAnswer = question.answer;
    let isCorrect = false;
    if (question.type === 'fractions') {
        try {
            const userAnswerNum = parseFloat(userAnswerRaw);
            const correctAnswerNum = parseFloat(correctAnswer);
            const tolerance = 0.0001;
            if (!isNaN(userAnswerNum) && !isNaN(correctAnswerNum)) {
                isCorrect = Math.abs(userAnswerNum - correctAnswerNum) < tolerance;
            } else {
                isCorrect = false;
            }
        } catch (e) {
            console.error("Error parsing fraction answer for comparison:", e);
            isCorrect = false;
        }
    } else {
        isCorrect = (userAnswerRaw.trim() === correctAnswer.trim());
    }
    return isCorrect;
}


/* ---------------------------------------
   QUESTION GENERATION
---------------------------------------- */
 function generateMultiplication(difficulty) {
  let num1, num2;
  switch (difficulty) {
    case 'easy': num1 = getRandomInt(1, 10); num2 = getRandomInt(1, 10); break;
    case 'medium':
      num1 = getRandomInt(1, 10);
      num2 = getRandomInt(11, 30);
      if (Math.random() > 0.5) [num1, num2] = [num2, num1];
      break;
    case 'hard': num1 = getRandomInt(11, 30); num2 = getRandomInt(11, 30); break;
    case 'expert': num1 = getRandomInt(31, 50); num2 = getRandomInt(31, 50); break;
    default: num1 = getRandomInt(1, 10); num2 = getRandomInt(1, 10);
  }
  return { text: `${num1} × ${num2}?`, answer: (num1 * num2).toString(), type: 'multiplication', difficulty };
}

function generateSquare(difficulty) {
    let base;
    switch (difficulty) {
        case 'easy': base = getRandomInt(1, 20); break;
        case 'medium': base = getRandomInt(21, 30); break;
        case 'hard': base = getRandomInt(31, 40); break;
        case 'expert': base = getRandomInt(41, 50); break;
        default: base = getRandomInt(1, 20);
    }
    return { text: `${base}²?`, answer: (base * base).toString(), type: 'squares', difficulty };
}

function generateCube(difficulty) {
    let base;
    switch (difficulty) {
        case 'easy': base = getRandomInt(1, 10); break;
        case 'medium': base = getRandomInt(11, 20); break;
        case 'hard': base = getRandomInt(21, 30); break;
        case 'expert': base = getRandomInt(31, 40); break;
        default: base = getRandomInt(1, 10);
    }
    return { text: `${base}³?`, answer: (base * base * base).toString(), type: 'cubes', difficulty };
}

function generateSquareRoot(difficulty) {
    let root;
    switch (difficulty) {
        case 'easy': root = getRandomInt(1, 20); break;
        case 'medium': root = getRandomInt(21, 30); break;
        case 'hard': root = getRandomInt(31, 40); break;
        case 'expert': root = getRandomInt(41, 50); break;
        default: root = getRandomInt(1, 20);
    }
    const perfectSquare = root * root;
    return { text: `√${perfectSquare}?`, answer: root.toString(), type: 'sqrt', difficulty };
}

function generateCubeRoot(difficulty) {
    let root;
    switch (difficulty) {
        case 'easy': root = getRandomInt(1, 10); break;
        case 'medium': root = getRandomInt(11, 20); break;
        case 'hard': root = getRandomInt(21, 30); break;
        case 'expert': root = getRandomInt(31, 40); break;
        default: root = getRandomInt(1, 10);
    }
    const perfectCube = root * root * root;
    return { text: `³√${perfectCube}?`, answer: root.toString(), type: 'cbrt', difficulty };
}

function generateFraction(difficulty) {
    let n1, d1, questionText;
    let maxNumDen = 10;
    do {
        n1 = getRandomInt(1, maxNumDen);
        d1 = getRandomInt(1, maxNumDen);
    } while (d1 === 0 || (n1 % d1 === 0));
    questionText = `What is the decimal value of ${n1}/${d1}?`;
    const decimalAnswer = n1 / d1;
    const formattedAnswer = formatDecimalAnswer(decimalAnswer);
    return { text: questionText, answer: formattedAnswer, type: 'fractions', difficulty };
}

function getAdaptiveQuestionPool(profile, availableTypes) {
    const reviewPool = [];
    const masteryPool = [];
    const now = new Date();

    // 1. Prioritize topics due for spaced repetition
    if (profile.nextReviewSchedule) {
        for (const type in profile.nextReviewSchedule) {
            if (availableTypes.includes(type)) {
                for (const difficulty in profile.nextReviewSchedule[type]) {
                    if (new Date(profile.nextReviewSchedule[type][difficulty]) <= now) {
                        reviewPool.push({ type, difficulty, weight: 10 }); // High weight for review items
                    }
                }
            }
        }
    }
    if (reviewPool.length > 0) {
         console.log("ADAPTIVE: Prioritizing from review pool.", reviewPool);
         return reviewPool;
    }

    // 2. If no reviews are due, build a pool based on mastery
    questionTypes.forEach(type => {
        if (availableTypes.includes(type)) {
            difficultyLevels.forEach(difficulty => {
                const mastery = profile.detailedPerformance[type]?.[difficulty]?.mastery ?? 0;
                // Weight is inversely proportional to mastery. Higher weight for lower mastery.
                const weight = Math.ceil((1 - mastery) * 10);
                if (weight > 0) {
                    masteryPool.push({ type, difficulty, weight });
                }
            });
        }
    });
    
    // Create the final pool based on weights
    const finalPool = [];
    masteryPool.forEach(item => {
        for (let i = 0; i < item.weight; i++) {
            finalPool.push({ type: item.type, difficulty: item.difficulty });
        }
    });

    console.log("ADAPTIVE: Using mastery-based pool.", finalPool);
    return finalPool.length > 0 ? finalPool : null;
}


function generateQuestion() {
  if (!currentSessionSettings) {
      console.error("Cannot generate question: session settings not loaded.");
      return generateMultiplication('easy'); // Fallback
  }

  // === Targeted Practice Logic ===
  if (currentSessionSettings.mode === 'section5') {
      const { targetType, targetValues, targetValueMin, targetValueMax } = currentSessionSettings;
      const MULT_RANGE = 12;
      let newQuestion = null;
      try {
         if (targetType === 'multiplicationTable') {
            const table = targetValues[getRandomInt(0, targetValues.length - 1)];
            const num2 = getRandomInt(1, MULT_RANGE);
            const text = Math.random() > 0.5 ? `${table} × ${num2}?` : `${num2} × ${table}?`;
            newQuestion = { text: text, answer: (table * num2).toString(), type: 'multiplication', difficulty: 'targeted' };
         } else if (targetType === 'squareRange') {
            const base = getRandomInt(targetValueMin, targetValueMax);
            newQuestion = { text: `${base}²?`, answer: (base * base).toString(), type: 'squares', difficulty: 'targeted' };
         } else if (targetType === 'cubeRange') {
             const base = getRandomInt(targetValueMin, targetValueMax);
             newQuestion = { text: `${base}³?`, answer: (base * base * base).toString(), type: 'cubes', difficulty: 'targeted' };
         } else {
              console.error("Unknown targeted practice type:", targetType);
              newQuestion = generateMultiplication('easy'); // Fallback
         }
      } catch (e) {
          console.error("Error generating targeted question:", e);
          newQuestion = generateMultiplication('easy'); // Fallback
      }
       currentQuestion = newQuestion;
       return currentQuestion;
  }

  // === Logic for other modes ===
  let availableTypes = currentSessionSettings.types.length > 0 ? currentSessionSettings.types : ['multiplication'];
  let difficultyToUse;
  let questionFunc;

  // === MODIFIED ADAPTIVE LOGIC ===
  if (isAdaptiveMode) {
        const userProfile = loadUserPerformance();
        const adaptivePool = getAdaptiveQuestionPool(userProfile, availableTypes);
        let questionParams;

        if (adaptivePool && adaptivePool.length > 0) {
            questionParams = adaptivePool[getRandomInt(0, adaptivePool.length - 1)];
        } else {
            // Fallback if there's no history or all types are mastered: select a random available type
            const selectedType = availableTypes[getRandomInt(0, availableTypes.length - 1)];
            questionParams = { type: selectedType, difficulty: 'easy' }; // Start easy on new types
        }
         // In-session difficulty still overrides the difficulty from the pool for a smoother experience
        difficultyToUse = adaptiveDifficultyLevel;
        switch (questionParams.type) {
            case 'multiplication': questionFunc = generateMultiplication; break;
            case 'squares': questionFunc = generateSquare; break;
            case 'cubes': questionFunc = generateCube; break;
            case 'sqrt': questionFunc = generateSquareRoot; break;
            case 'cbrt': questionFunc = generateCubeRoot; break;
            case 'fractions': questionFunc = generateFraction; break;
            default: questionFunc = generateMultiplication;
        }
  }
  // === END OF MODIFIED ADAPTIVE LOGIC ===
  else { // Regular, non-adaptive logic for other modes
      const selectedType = availableTypes[getRandomInt(0, availableTypes.length - 1)];

      if (isChallengeMode) {
          difficultyToUse = adaptiveDifficultyLevel;
      } else {
          const availableDifficulties = currentSessionSettings.difficulty.length > 0 ? currentSessionSettings.difficulty : ['easy'];
          difficultyToUse = availableDifficulties[getRandomInt(0, availableDifficulties.length - 1)];
      }

      switch (selectedType) {
          case 'multiplication': questionFunc = generateMultiplication; break;
          case 'squares': questionFunc = generateSquare; break;
          case 'cubes': questionFunc = generateCube; break;
          case 'sqrt': questionFunc = generateSquareRoot; break;
          case 'cbrt': questionFunc = generateCubeRoot; break;
          case 'fractions': questionFunc = generateFraction; break;
          default: questionFunc = generateMultiplication;
      }
  }

   currentQuestion = questionFunc(difficultyToUse);
   return currentQuestion;
}


/* ---------------------------------------
   ADAPTIVE & CHALLENGE LOGIC
---------------------------------------- */
function increaseDifficulty() {
    const currentIndex = difficultyLevels.indexOf(adaptiveDifficultyLevel);
    if (currentIndex < difficultyLevels.length - 1) {
        adaptiveDifficultyLevel = difficultyLevels[currentIndex + 1];
        console.log("Difficulty Increased to:", adaptiveDifficultyLevel);
    }
}

function decreaseDifficulty() {
    const currentIndex = difficultyLevels.indexOf(adaptiveDifficultyLevel);
    if (currentIndex > 0) {
        adaptiveDifficultyLevel = difficultyLevels[currentIndex - 1];
        console.log("Difficulty Decreased to:", adaptiveDifficultyLevel);
    }
}

function updateAdaptiveState(status) {
    if (isAdaptiveMode) {
        if (status === 'correct') {
            consecutiveCorrectAnswers++;
            consecutiveIncorrectAnswers = 0;
            if (consecutiveCorrectAnswers >= adaptiveIncreaseThreshold) {
                increaseDifficulty();
                consecutiveCorrectAnswers = 0;
            }
        } else if (status === 'incorrect') {
            consecutiveIncorrectAnswers++;
            consecutiveCorrectAnswers = 0;
            if (consecutiveIncorrectAnswers >= ADAPTIVE_DECREASE_THRESHOLD) {
                if (adaptiveDifficultyLevel !== difficultyLevels[0]) {
                     decreaseDifficulty();
                }
                consecutiveIncorrectAnswers = 0;
            }
        } else { // Skipped
             consecutiveCorrectAnswers = 0;
             consecutiveIncorrectAnswers = 0;
        }
    } else if (isChallengeMode) {
         if (status === 'correct') {
              consecutiveCorrectAnswers++;
              if (consecutiveCorrectAnswers >= challengeDifficultyIncreaseThreshold) {
                  increaseDifficulty();
                  consecutiveCorrectAnswers = 0;
              }
         } else {
             consecutiveCorrectAnswers = 0;
         }
    }
}

function updateChallengeState(status, difficulty) {
    if (!isChallengeMode || status !== 'correct' || !difficulty || difficulty === 'targeted') return;
    const timeBonus = challengeTimeBonuses[difficulty] || 0;
    challengeScore += timeBonus;
    if (sessionTimerId && remainingTime >= 0) {
        const bonusSeconds = Math.round(timeBonus);
        remainingTime += bonusSeconds;
        console.log(`Challenge Score: ${challengeScore.toFixed(1)}, Time Bonus: +${timeBonus}s (difficulty ${difficulty}), Added ${bonusSeconds}s, New Remaining: ${remainingTime}s`);
        updateStatusIndicator();
    }
}

/* ---------------------------------------
   UI & THEME MANAGEMENT
---------------------------------------- */
  function toggleMode() {
      body.classList.toggle('dark-mode');
      currentMode = body.classList.contains('dark-mode') ? 'dark' : 'light';
      themeToggleButton.textContent = currentMode === 'dark' ? '☀️' : '🌙';
      // Re-render components that depend on theme variables if they are visible
      if (!sessionActive) {
        if(resultCard?.classList.contains('active') && currentArea === 'practice-area') {
            renderTimeGraph('live', sessionDetails);
            // Pie chart is already rendered with correct colors
        }
        if(dashboardArea?.classList.contains('active') && currentArea === 'dashboard-area') {
            renderDashboard();
        }
        if (reviewDetailCard?.style.display !== 'none' && currentArea === 'review-area') {
            // Re-render the visible review graph if theme changes
            const profile = loadUserPerformance();
            const visibleSessionId = reviewDetailCard.dataset.sessionId;
            const sessionData = profile.sessionHistory.find(s => s.sessionId === visibleSessionId);
            if (sessionData) {
                renderTimeGraph('review', sessionData.details);
            }
        }
      }
      try {
         localStorage.setItem('themeMode', currentMode);
      } catch (e) {
         console.warn("Could not save theme preference to localStorage.");
      }
  }

  function applySavedTheme() {
      try {
          const savedMode = localStorage.getItem('themeMode');
          if (savedMode === 'dark') {
              body.classList.add('dark-mode');
              currentMode = 'dark';
              themeToggleButton.textContent = '☀️';
          } else {
              body.classList.remove('dark-mode');
              currentMode = 'light';
              themeToggleButton.textContent = '🌙';
          }
      } catch (e) {
          console.warn("Could not load theme preference from localStorage.");
          currentMode = 'light';
          themeToggleButton.textContent = '🌙';
      }
  }

/* ---------------------------------------
   AREA & SECTION NAVIGATION
---------------------------------------- */
function showArea(areaId) {
    if (sessionActive && areaId !== 'practice-area') {
        console.warn("Cannot switch away from Practice area during an active session.");
        closeNavMenu();
        return;
    }

    console.log(`Switching to area: ${areaId}`);
    currentArea = areaId;

    // Hide all top-level areas
    practiceArea.classList.remove('active');
    studyArea.classList.remove('active');
    dashboardArea.classList.remove('active');
    reviewArea.classList.remove('active'); // NEW

    // Show the target area
    const targetArea = document.getElementById(areaId);
    if (targetArea) {
        targetArea.classList.add('active');

        // Update page title
        if (pageTitleEl) {
             const titleText = areaId.split('-')[0]; // practice, study, dashboard
             pageTitleEl.textContent = `Mathex - ${titleText.charAt(0).toUpperCase() + titleText.slice(1)}`;
        }

        // Update active class in nav menu
        navLinks.forEach(link => {
            link.classList.remove('nav-active');
            if (link.dataset.area === areaId) {
                link.classList.add('nav-active');
            }
        });

        // --- Specific Area Setup ---
        if (areaId === 'dashboard-area') {
            renderDashboard();
        } else if (areaId === 'practice-area' && !sessionActive) {
             // If returning to practice setup, ensure correct card is visible
             if(mainCard) mainCard.style.display = 'block';
             if(sessionCard) sessionCard.style.display = 'none';
             if(resultCard) resultCard.style.display = 'none';
             if(sessionCard) sessionCard.classList.remove('active');
             if(resultCard) resultCard.classList.remove('active');
             // Show the last selected section or default to section1
             const currentActiveSectionButton = practiceArea.querySelector('.section-buttons button.active');
             if (!currentActiveSectionButton) {
                 showSection('section1');
             } else {
                 showSection(currentActiveSectionButton.id.replace('btn-',''));
             }
         } else if (areaId === 'study-area') {
            // Focus the study area container or its heading
             setTimeout(() => {
                 const studyContainer = studyArea.querySelector('.study-container');
                 (studyContainer?.querySelector('h1') || studyContainer)?.focus();
             }, 50);
             // Ensure study area answer state matches button
             const studyToggleBtn = studyArea.querySelector('#toggle-answers-btn');
             if (studyToggleBtn) {
                const state = studyToggleBtn.getAttribute('data-state');
                if (state === 'hidden') {
                    studyArea.classList.add('answers-hidden');
                } else {
                    studyArea.classList.remove('answers-hidden');
                }
             }
         } else if (areaId === 'review-area') { // NEW
            renderSessionHistoryList();
            showReviewList(); // Ensure the list is visible by default
         }
    } else {
        console.error("Target area not found:", areaId);
    }

    handleResize(); // Update layout (e.g., info button visibility) based on new area
    closeNavMenu(); // Close nav menu after switching
}

// Specific to Practice Area Sections
function showSection(sectionId) {
  // Only allow changing sections if in practice area and session is not active
  if (currentArea !== 'practice-area' || sessionActive) return;

  document.querySelectorAll('#practice-area .section').forEach((s) => {
    s.classList.remove('active');
    s.setAttribute('aria-hidden', 'true');
  });
  document.querySelectorAll('#practice-area .section-buttons button').forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
  });
  const targetSection = document.getElementById(sectionId);
  const targetButton = document.getElementById('btn-' + sectionId);
  if(targetSection) {
      targetSection.classList.add('active');
      targetSection.setAttribute('aria-hidden', 'false');
      const firstInput = targetSection.querySelector('input, button');
      if (firstInput && document.activeElement !== firstInput) setTimeout(() => firstInput.focus(), 50);
  }
   if(targetButton) {
      targetButton.classList.add('active');
      targetButton.setAttribute('aria-selected', 'true');
  }
   if (sectionId === 'section5') {
      updateTargetedInputs();
      updateTargetedLimitInput();
   }
}

// Specific to Practice Area Adaptive Mode Sub-toggle
function toggleSub(type) {
  if (currentArea !== 'practice-area' || sessionActive) return;

  subFqButton.classList.remove('active');
  subFtButton.classList.remove('active');
  subFqButton.setAttribute('aria-selected', 'false');
  subFtButton.setAttribute('aria-selected', 'false');
  if (type === 'fq') {
    s3AdaptiveInput.placeholder = 'Number of Questions (e.g., 15)';
    s3AdaptiveInput.dataset.mode = 'questions';
    s3InputLabel.textContent = 'Number of Questions';
    subFqButton.classList.add('active');
    subFqButton.setAttribute('aria-selected', 'true');
    s3AdaptiveInput.value = '15';
    subFqButton.focus();
  } else {
    s3AdaptiveInput.placeholder = 'Time Duration (seconds, e.g., 90)';
    s3AdaptiveInput.dataset.mode = 'time';
    s3InputLabel.textContent = 'Time Duration (seconds)';
    subFtButton.classList.add('active');
    subFtButton.setAttribute('aria-selected', 'true');
    s3AdaptiveInput.value = '90';
    subFtButton.focus();
  }
  if(document.activeElement !== s3AdaptiveInput) setTimeout(() => s3AdaptiveInput.focus(), 50);
}

 // Specific to Practice Area Checkbox/Radio Groups
 function getSelectedValues(selector) {
     // Ensure the selector targets within the practice area if needed
     const fullSelector = `#practice-area ${selector}`;
     return Array.from(document.querySelectorAll(fullSelector))
                 .filter(el => el.checked)
                 .map(el => el.value);
 }

 /* ---------------------------------------
    NAVIGATION MENU CONTROL
 ---------------------------------------- */
 function toggleNavMenu() {
     if (!hamburgerBtn || !mainNav) return;
     const isExpanded = hamburgerBtn.getAttribute('aria-expanded') === 'true';
     hamburgerBtn.classList.toggle('active');
     mainNav.classList.toggle('active');
     hamburgerBtn.setAttribute('aria-expanded', !isExpanded);
     if (!isExpanded) {
        const firstLink = mainNav.querySelector('a');
        if(firstLink) setTimeout(() => firstLink.focus(), 50);
     }
 }

 function closeNavMenu() {
     if (!hamburgerBtn || !mainNav) return;
     hamburgerBtn.classList.remove('active');
     mainNav.classList.remove('active');
     hamburgerBtn.setAttribute('aria-expanded', 'false');
 }

 if (hamburgerBtn) hamburgerBtn.addEventListener('click', toggleNavMenu);

 document.addEventListener('click', (event) => {
    // Close Nav Menu
    if (mainNav?.classList.contains('active') && !mainNav.contains(event.target) && event.target !== hamburgerBtn && !hamburgerBtn?.contains(event.target)) {
        closeNavMenu();
    }
    // Close Desktop Info Tooltip
    if (window.innerWidth > 600 && infoTooltip?.classList.contains('tooltip-visible')) {
        if (infoContainer && !infoContainer.contains(event.target)) {
            hideInfo();
        }
    }
    // Close Graph Tooltip
    if (graphTooltipEl?.classList.contains('tooltip-visible')) {
        const clickedBar = event.target.closest('.time-graph .bar');
        if (!graphTooltipEl.contains(event.target) && !clickedBar) {
             hideGraphTooltip();
        }
    }
    // Remove Study Area highlight on click outside
    if (currentArea === 'study-area') {
         const highlightedItem = studyArea.querySelector('.highlighted');
         const clickedItem = event.target.closest('#study-area .table-block p, #study-area .value-item');
         if (highlightedItem && highlightedItem !== clickedItem && !highlightedItem.contains(event.target)) {
             highlightedItem.classList.remove('highlighted');
         }
    }
 });


 /* ---------------------------------------
    SESSION SETUP & CONTROL
 ---------------------------------------- */
 function getSessionSettings() {
     const activeSection = practiceArea.querySelector('.section.active'); // Look within practice area
     if (!activeSection) {
         console.error("No active practice section found.");
         return null;
     }
     const sectionId = activeSection.id;
     let settings = {
        mode: sectionId,
        numQuestions: 0,
        timeLimit: 0,
        types: [],
        difficulty: [],
        adaptiveSubMode: 'questions',
        targetType: null,
        targetValues: [],
        targetValueMin: null,
        targetValueMax: null,
        limitType: 'questions',
     };

     // --- Standard Modes (Sections 1, 2, 3, 4) ---
     if (sectionId !== 'section5') {
         settings.types = getSelectedValues(`#${sectionId} .checkbox-options[data-group$="-types"] input:checked`);
         if (settings.types.length === 0 && sectionId !== 'section3') {
             alert("Please select at least one Question Type.");
             return null;
         }
         if (sectionId === 'section1' || sectionId === 'section2') {
             settings.difficulty = getSelectedValues(`#${sectionId} .checkbox-options[data-group$="-difficulty"] input:checked`);
             if (settings.difficulty.length === 0) {
                  settings.difficulty = ['easy']; // Default to easy if none selected
             }
         } else if (sectionId === 'section4') {
             const diffRadio = activeSection.querySelector(`#${sectionId} .checkbox-options[data-group$="-difficulty"] input[type="radio"]:checked`);
             settings.difficulty = diffRadio ? [diffRadio.value] : ['easy'];
         } else if (sectionId === 'section3') {
             settings.difficulty = ['easy']; // Adaptive starts easy
             if(settings.types.length === 0) settings.types = ['multiplication']; // Default type if none selected
         }
         try {
             let inputElement, value;
             if (sectionId === 'section1') {
                 inputElement = document.getElementById('s1-numQuestions');
                 value = parseInt(inputElement?.value, 10);
                 if (!inputElement || !inputElement.value || isNaN(value) || value < 1) { alert("Please enter a valid Number of Questions (minimum 1)."); inputElement?.focus(); return null; }
                 settings.numQuestions = value;
             } else if (sectionId === 'section2') {
                 inputElement = document.getElementById('s2-timeDuration');
                 value = parseInt(inputElement?.value, 10);
                  if (!inputElement || !inputElement.value || isNaN(value) || value < 10) { alert("Please enter a valid Time Duration (minimum 10 seconds)."); inputElement?.focus(); return null; }
                 settings.timeLimit = value;
             } else if (sectionId === 'section3') {
                 inputElement = s3AdaptiveInput;
                 settings.adaptiveSubMode = inputElement.dataset.mode || 'questions';
                 value = parseInt(inputElement?.value, 10);
                 if (!inputElement || !inputElement.value || isNaN(value)) { alert(`Please enter a valid ${settings.adaptiveSubMode === 'questions' ? 'Number of Questions' : 'Time Duration'}.`); inputElement?.focus(); return null; }
                 if (settings.adaptiveSubMode === 'questions') {
                      if (value < 1) { alert("Number of Questions must be at least 1."); inputElement?.focus(); return null; }
                     settings.numQuestions = value;
                 } else {
                      if (value < 10) { alert("Time Duration must be at least 10 seconds."); inputElement?.focus(); return null; }
                     settings.timeLimit = value;
                 }
             } else if (sectionId === 'section4') {
                 inputElement = document.getElementById('s4-timeDuration');
                 value = parseInt(inputElement?.value, 10);
                 if (!inputElement || !inputElement.value || isNaN(value) || value < 30) { alert("Please enter a valid Initial Time Duration (minimum 30 seconds)."); inputElement?.focus(); return null; }
                 settings.timeLimit = value;
             }
         } catch (e) {
             console.error("Error parsing number/time inputs:", e);
             alert("Invalid number or time entered. Please check your inputs.");
             return null;
         }
     }
     // --- Targeted Mode (Section 5) ---
     else { // sectionId === 'section5'
         settings.targetType = activeSection.querySelector('input[name="s5-target-type"]:checked')?.value;
         if (!settings.targetType) { alert("Please select a Target Type."); activeSection.querySelector('input[name="s5-target-type"]')?.focus(); return null; }
         try {
            if (settings.targetType === 'multiplicationTable') {
                const input = document.getElementById('s5-targetValue1');
                settings.targetValues = parseNumberList(input?.value);
                if (!input || settings.targetValues.length === 0) { alert("Please enter valid table numbers or range."); input?.focus(); return null; }
            } else if (settings.targetType === 'squareRange' || settings.targetType === 'cubeRange') {
                 const inputMin = document.getElementById(settings.targetType === 'squareRange' ? 's5-targetValueMinSq' : 's5-targetValueMinCb');
                 const inputMax = document.getElementById(settings.targetType === 'squareRange' ? 's5-targetValueMaxSq' : 's5-targetValueMaxCb');
                 settings.targetValueMin = parseInt(inputMin?.value, 10);
                 settings.targetValueMax = parseInt(inputMax?.value, 10);
                 if (!inputMin || !inputMax || isNaN(settings.targetValueMin) || isNaN(settings.targetValueMax) || settings.targetValueMin < 1 || settings.targetValueMax < 1) { alert("Please enter valid Min and Max values (minimum 1)."); (inputMin || inputMax)?.focus(); return null; }
                 if (settings.targetValueMin > settings.targetValueMax) { alert("Min value cannot be greater than Max value."); inputMin?.focus(); return null; }
             }
         } catch (e) {
              console.error("Error parsing targeted value inputs:", e);
              alert("Invalid target value entered. Please check your inputs.");
              return null;
         }
         settings.limitType = activeSection.querySelector('input[name="s5-limit-type"]:checked')?.value || 'questions';
         const limitInput = document.getElementById('s5-limitValue');
         const limitValue = parseInt(limitInput?.value, 10);
         if (settings.limitType === 'questions') {
             if (!limitInput || isNaN(limitValue) || limitValue < 1) { alert("Please enter a valid Number of Questions (minimum 1)."); limitInput?.focus(); return null; }
             settings.numQuestions = limitValue;
         } else { // 'time'
             if (!limitInput || isNaN(limitValue) || limitValue < 10) { alert("Please enter a valid Time Duration (minimum 10 seconds)."); limitInput?.focus(); return null; }
             settings.timeLimit = limitValue;
         }
         settings.difficulty = ['targeted']; // Use a specific difficulty identifier
         settings.types = [settings.targetType]; // Type is determined by target type
     }
     console.log("Session Settings:", settings);
     return settings;
 }

function startSession() {
  if (currentArea !== 'practice-area') return; // Can only start from practice area
  // Basic null checks for essential elements
  if (!mainCard || !sessionCard || !resultCard || !progressBar || !progressBarContainer || !statusIndicator || !sessionQuestionEl || !sessionAnswerInput) {
      console.error("Cannot start session: Essential UI elements not found.");
      alert("Error: UI components missing. Cannot start session.");
      return;
  }

  currentSessionSettings = getSessionSettings();
  if (!currentSessionSettings) return;

  sessionActive = true;
  sessionStartTime = Date.now();
  sessionEndTime = 0;
  questionIndex = 0;
  correctCount = 0;
  incorrectCount = 0;
  skippedCount = 0;
  sessionDetails = [];
  clearTimeout(sessionTimerId);
  sessionTimerId = null;
  currentQuestion = null;
  isAutoSubmitting = false;
  currentStreak = 0;
  maxStreak = 0;
  consecutiveCorrectAnswers = 0;
  consecutiveIncorrectAnswers = 0;

  totalQuestionsTarget = currentSessionSettings.numQuestions;
  sessionDurationTarget = currentSessionSettings.timeLimit;
  isAdaptiveMode = currentSessionSettings.mode === 'section3';
  isChallengeMode = currentSessionSettings.mode === 'section4';
  adaptiveDifficultyLevel = currentSessionSettings.difficulty[0] || difficultyLevels[0]; // Use first difficulty as start or default
  challengeScore = 0;
  if(challengeScoreContainer) challengeScoreContainer.classList.remove('active');

  if (isAdaptiveMode) {
       if (currentSessionSettings.adaptiveSubMode === 'questions' && totalQuestionsTarget > 0) {
           adaptiveIncreaseThreshold = Math.max(2, Math.min(5, Math.ceil(totalQuestionsTarget * 0.2)));
       } else {
           adaptiveIncreaseThreshold = 5; // Default for time-based adaptive
       }
       console.log("Adaptive Increase Threshold:", adaptiveIncreaseThreshold, "Decrease Threshold:", ADAPTIVE_DECREASE_THRESHOLD);
  }

  console.log("Starting Session - Mode:", currentSessionSettings.mode, "Adaptive:", isAdaptiveMode, "Challenge:", isChallengeMode, "Targeted:", currentSessionSettings.mode === 'section5', "Start Diff:", adaptiveDifficultyLevel);

  // UI Updates (within Practice Area)
  mainCard.style.display = 'none';
  resultCard.classList.remove('active');
  resultCard.setAttribute('aria-hidden', 'true');
  resultCard.style.display = 'none';
  sessionCard.classList.add('active');
  sessionCard.setAttribute('aria-hidden', 'false');
  sessionCard.style.display = 'block';
  progressBar.style.width = '0%';
  progressBarContainer.setAttribute('aria-valuenow', '0');
  handleResize(); // Hides info button container, etc.
  hideInfo();
  hideGraphTooltip();
  closeNavMenu();
  if (summaryPieChartContainer) summaryPieChartContainer.innerHTML = '<div class="pie-chart-placeholder" style="color: var(--text-secondary); font-style: italic; padding: 20px 0;"></div>';
  if (summaryPieChartLegend) summaryPieChartLegend.innerHTML = '';

  if (sessionDurationTarget > 0) {
       startSessionTimer(sessionDurationTarget);
   } else {
       updateStatusIndicator();
   }
  nextQuestion();
}

function updateStatusIndicator() {
    if (!statusIndicator || !progressBarContainer || !progressBar) return;
    let text = "";
    let currentProgressIndex = sessionDetails.length;
    let currentDisplayNum = currentProgressIndex + 1;
    let progressTarget = totalQuestionsTarget;
    let isTimeBasedLimit = false;
    if (currentSessionSettings?.mode === 'section2' ||
        (isAdaptiveMode && currentSessionSettings?.adaptiveSubMode === 'time') ||
        currentSessionSettings?.mode === 'section4' ||
        (currentSessionSettings?.mode === 'section5' && currentSessionSettings?.limitType === 'time')) {
        progressTarget = sessionDurationTarget;
        isTimeBasedLimit = true;
    }
    if (totalQuestionsTarget > 0 && !isTimeBasedLimit) {
        text = `Question ${Math.min(currentDisplayNum, totalQuestionsTarget)} / ${totalQuestionsTarget}`;
    } else if (isTimeBasedLimit) {
        // For time modes, just show current question number, not total time
        text = `Question ${currentDisplayNum}`;
    } else {
         // Fallback for modes without explicit limit (though should have one)
         text = `Question ${currentDisplayNum}`;
    }
    // Add targeted info if applicable
    if(currentSessionSettings && currentSessionSettings.mode === 'section5') {
        let targetDesc = '';
        switch(currentSessionSettings.targetType) {
            case 'multiplicationTable': targetDesc = `${currentSessionSettings.targetValues.join(',')}× Table`; break;
            case 'squareRange': targetDesc = `Squares ${currentSessionSettings.targetValueMin}-${currentSessionSettings.targetValueMax}`; break;
            case 'cubeRange': targetDesc = `Cubes ${currentSessionSettings.targetValueMin}-${currentSessionSettings.targetValueMax}`; break;
        }
         text = `${targetDesc} - ${text}`;
    }
    // Calculate Progress Bar Percentage
    let progressPercent = 0;
    if (progressTarget > 0) {
        if (isTimeBasedLimit) {
            // Progress based on time elapsed
            const elapsed = sessionDurationTarget - remainingTime;
            progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / progressTarget) * 100)));
        } else {
            // Progress based on questions answered
            progressPercent = Math.min(100, Math.round((currentProgressIndex / progressTarget) * 100));
        }
    }
    progressBar.style.width = `${progressPercent}%`;
    progressBarContainer.setAttribute('aria-valuenow', progressPercent);
    // Add time remaining if applicable
    if (sessionDurationTarget > 0 && remainingTime >= 0) {
         const minutes = Math.floor(remainingTime / 60);
         const seconds = remainingTime % 60;
         const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
         text += ` (${timeString} left)`;
    }
    // Add difficulty/streak info
    if (isAdaptiveMode || isChallengeMode) {
        text += ` [${adaptiveDifficultyLevel}]`;
    }
    if (currentStreak > 0) {
        text += ` (Streak: ${currentStreak})`;
    }
    statusIndicator.textContent = text;
}

function startSessionTimer(durationSeconds) {
    remainingTime = durationSeconds;
    updateStatusIndicator();
    clearTimeout(sessionTimerId);
    sessionTimerId = setInterval(() => {
        if (!sessionActive) {
            clearTimeout(sessionTimerId);
            return;
        }
        remainingTime--;
        updateStatusIndicator();
        if (remainingTime < 0) {
            remainingTime = 0;
            updateStatusIndicator();
            console.log("Time's up!");
            endSession();
        }
    }, 1000);
}

function nextQuestion() {
  if (!sessionActive) return;
  if (!sessionQuestionEl || !sessionAnswerInput) return; // Element check

  if (totalQuestionsTarget > 0 && sessionDetails.length >= totalQuestionsTarget) {
    console.log("Target questions reached.");
    endSession();
    return;
  }
  questionIndex = sessionDetails.length + 1;
  isAutoSubmitting = false;
  sessionAnswerInput.value = '';
  const q = generateQuestion();
  if (!q) {
      console.error("Failed to generate question!");
      alert("Error generating question. Ending session.");
      endSession();
      return;
  }
   sessionQuestionEl.textContent = q.text;
  setTimeout(() => {
     if(sessionActive && document.activeElement !== sessionAnswerInput) sessionAnswerInput.focus();
  }, 50);
  updateStatusIndicator();
  questionStartTime = Date.now();
}


function recordAnswer(status) {
    if (!sessionActive || !currentQuestion) {
        console.warn("recordAnswer called, but session inactive or no current question.");
        return;
    }
    const timeTakenMs = Date.now() - questionStartTime;
    const userAnswerRaw = sessionAnswerInput.value.trim();
    let userAnswerFormatted = userAnswerRaw;
    if (status !== 'skipped') {
        try {
            const userAnswerFloat = parseFloat(userAnswerRaw);
            if (!isNaN(userAnswerFloat)) {
                if (currentQuestion.type === 'fractions') {
                    userAnswerFormatted = formatDecimalAnswer(userAnswerFloat);
                } else {
                     userAnswerFormatted = userAnswerRaw; // Keep raw non-fraction numbers as string
                }
            } else {
                userAnswerFormatted = userAnswerRaw; // Keep non-numeric input as is
            }
        } catch (e) {
            userAnswerFormatted = userAnswerRaw; // Fallback on error
        }
    }
    const userAnswerForStorage = (status === 'skipped') ? 'Skipped' : userAnswerFormatted;
    const { answer: correctAnswer, text: questionText, difficulty: questionDifficulty, type: questionType } = currentQuestion;
    sessionDetails.push({
        questionText: questionText || `Question ${sessionDetails.length + 1}`,
        correctAnswer: correctAnswer || 'N/A',
        userAnswer: userAnswerForStorage,
        timeMs: (status === 'skipped' ? null : timeTakenMs),
        status: status,
        difficulty: questionDifficulty,
        type: questionType
    });
    if (status === 'correct') {
        correctCount++;
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
    } else {
        currentStreak = 0;
        if (status === 'incorrect') incorrectCount++;
        else if (status === 'skipped') skippedCount++;
    }
    updateAdaptiveState(status);
    updateChallengeState(status, questionDifficulty);
    console.log(`Answer recorded: ${status}. User: '${userAnswerRaw}', Correct: '${correctAnswer}', Stored User Answer: '${userAnswerForStorage}', Q-Diff: ${questionDifficulty}. Streak: ${currentStreak}/${maxStreak}. Proceeding.`);
    nextQuestion(); // Proceed to the next question
}

function submitAnswer() {
    if (!sessionActive || isAutoSubmitting || !currentQuestion) return;
    if (!sessionAnswerInput) return; // Element check
    const userAnswerRaw = sessionAnswerInput.value.trim();
    if (userAnswerRaw === '') {
        sessionAnswerInput.focus();
        return; // Don't submit empty answers
    }
    const isCorrect = checkAnswerCorrectness(userAnswerRaw, currentQuestion);
    console.log(`Manual Submit: User='${userAnswerRaw}', Correct=${isCorrect}`);
    recordAnswer(isCorrect ? 'correct' : 'incorrect');
}

if (sessionAnswerInput) {
    sessionAnswerInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter' && sessionActive && !isAutoSubmitting) {
            event.preventDefault();
            submitAnswer();
        }
    });

    sessionAnswerInput.addEventListener('input', function(event) {
        if (sessionActive && currentQuestion && !isAutoSubmitting) {
            const userAnswerRaw = event.target.value;
            const isCorrect = checkAnswerCorrectness(userAnswerRaw, currentQuestion);
            if (isCorrect) {
                console.log(`Auto-Submit Triggered: User='${userAnswerRaw}' is correct!`);
                isAutoSubmitting = true;
                recordAnswer('correct');
            }
        }
    });
}


function skipQuestion() {
    if (!sessionActive || isAutoSubmitting || !currentQuestion) return;
    console.log("Skipping question");
    recordAnswer('skipped');
}

function endSession() {
  if (!sessionActive) return;

  sessionActive = false;
  sessionEndTime = Date.now();
  clearTimeout(sessionTimerId);
  isAutoSubmitting = false;

  const totalAnswered = correctCount + incorrectCount;
  const accuracy = totalAnswered > 0 ? ((correctCount / totalAnswered) * 100) : 0;
  const sessionActualDurationMs = sessionEndTime - sessionStartTime;

  // Compile all session data into one object
  const fullSessionData = {
    sessionId: `session_${sessionStartTime}`, // Unique ID for the session
    startTime: sessionStartTime,
    endTime: sessionEndTime,
    maxStreak: maxStreak,
    settings: { ...currentSessionSettings, isChallengeMode, challengeScore },
    details: sessionDetails,
    summary: { // Keep a summary for quick display
        correct: correctCount,
        incorrect: incorrectCount,
        skipped: skippedCount,
        accuracy: accuracy,
        durationMs: sessionActualDurationMs
    }
  };

  const userProfile = loadUserPerformance();
  userProfile.endSession(fullSessionData);

  // Switch cards within Practice Area
  sessionCard.classList.remove('active');
  sessionCard.setAttribute('aria-hidden', 'true');
  sessionCard.style.display = 'none';
  resultCard.classList.add('active');
  resultCard.setAttribute('aria-hidden', 'false');
  resultCard.style.display = 'block';

  handleResize();
  hideGraphTooltip();
  closeNavMenu();

  // Render the results for the completed session
  renderResults(fullSessionData, 'live');

  resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const playAgainBtn = document.getElementById('playAgainBtn');
  if (playAgainBtn) setTimeout(() => playAgainBtn.focus(), 100);
}

/* ---------------------------------------
   RESULT & DASHBOARD RENDERING
---------------------------------------- */

/**
 * NEW: Generic function to render the results of a session into a view.
 * @param {object} sessionData - The full session object from sessionHistory.
 * @param {'live' | 'review'} viewType - The type of view to populate.
 */
function renderResults(sessionData, viewType) {
    if (!sessionData) return;

    const isLive = viewType === 'live';
    const sDetails = sessionData.details;
    const sSummary = sessionData.summary;
    const sSettings = sessionData.settings;

    // Determine the correct DOM elements based on the view type
    const accuracyEl = document.getElementById(isLive ? 'accuracyNumber' : 'reviewAccuracyNumber');
    const correctEl = document.getElementById(isLive ? 'correctNumber' : 'reviewCorrectNumber');
    const incorrectEl = document.getElementById(isLive ? 'incorrectNumber' : 'reviewIncorrectNumber');
    const skippedEl = document.getElementById(isLive ? 'skippedNumber' : 'reviewSkippedNumber');
    const streakEl = document.getElementById(isLive ? 'streakNumber' : 'reviewStreakNumber');
    const challengeScoreNumEl = document.getElementById(isLive ? 'challengeScoreNumber' : 'reviewChallengeScoreNumber');
    const challengeScoreContEl = document.getElementById(isLive ? 'challengeScoreContainer' : 'reviewChallengeScoreContainer');
    const pieContainerEl = document.getElementById(isLive ? 'summaryPieChartContainer' : 'reviewPieChartContainer');
    const pieLegendEl = document.getElementById(isLive ? 'summaryPieChartLegend' : 'reviewPieChartLegend');
    const timeGraphEl = document.getElementById(isLive ? 'timeGraph' : 'reviewTimeGraph');
    const avgTimeEl = document.getElementById(isLive ? 'avgTimeNumber' : 'reviewAvgTimeNumber');
    const fastestEl = document.getElementById(isLive ? 'fastestNumber' : 'reviewFastestNumber');
    const slowestEl = document.getElementById(isLive ? 'slowestNumber' : 'reviewSlowestNumber');
    const totalTimeEl = document.getElementById(isLive ? 'totalTimeNumber' : 'reviewTotalTimeNumber');
    const detailTableBodyEl = document.getElementById(isLive ? 'detailTableBody' : 'reviewDetailTableBody');
    const mobileDetailContEl = document.getElementById(isLive ? 'mobileDetailContainer' : 'reviewMobileDetailContainer');
    
    // Time calculations
    const validTimesMs = sDetails
        .filter(d => d.status !== 'skipped' && typeof d.timeMs === 'number' && !isNaN(d.timeMs))
        .map(d => d.timeMs);
    const avgTimeMs = validTimesMs.length > 0 ? validTimesMs.reduce((a, b) => a + b, 0) / validTimesMs.length : 0;
    const fastestTimeMs = validTimesMs.length > 0 ? Math.min(...validTimesMs) : 0;
    const slowestTimeMs = validTimesMs.length > 0 ? Math.max(...validTimesMs) : 0;

    // Populate summary numbers
    if (accuracyEl) accuracyEl.textContent = `${sSummary.accuracy.toFixed(1)}%`;
    if (correctEl) correctEl.textContent = sSummary.correct;
    if (incorrectEl) incorrectEl.textContent = sSummary.incorrect;
    if (skippedEl) skippedEl.textContent = sSummary.skipped;
    if (streakEl) streakEl.textContent = sessionData.maxStreak;
    if (totalTimeEl) totalTimeEl.textContent = formatTime(sSummary.durationMs, false);

    // Populate time analysis
    if (avgTimeEl) avgTimeEl.textContent = formatTime(avgTimeMs, true);
    if (fastestEl) fastestEl.textContent = formatTime(fastestTimeMs, true);
    if (slowestEl) slowestEl.textContent = formatTime(slowestTimeMs, true);
    
    // Handle challenge score display
    if (challengeScoreContEl && challengeScoreNumEl) {
        if (sSettings.isChallengeMode) {
            challengeScoreNumEl.textContent = sSettings.challengeScore.toFixed(1);
            challengeScoreContEl.style.display = 'block'; // Or add 'active' class
             challengeScoreContEl.classList.add('active');
        } else {
            challengeScoreContEl.style.display = 'none';
             challengeScoreContEl.classList.remove('active');
        }
    }
    
    // Render visual components
    renderPieChart(pieContainerEl, pieLegendEl, sSummary.correct, sSummary.incorrect, sSummary.skipped);
    renderTimeGraph(timeGraphEl, sDetails);
    renderDetailResultsTable(detailTableBodyEl, mobileDetailContEl, sDetails, avgTimeMs);
}


function renderTimeGraph(container, details) {
    if (!container) return;
    container.innerHTML = '';
    hideGraphTooltip();

    if (details.length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); font-style: italic; padding-left: 10px;">No time data available.</div>';
        return;
    }

    const timesMs = details.map(d => (d.status !== 'skipped' && d.timeMs ? d.timeMs : 0));
    const maxTime = Math.max(...timesMs, 1);
    let graphHeight = container.clientHeight;
    if (!graphHeight || graphHeight < 50) {
        graphHeight = window.innerWidth > 600 ? 250 : 150;
    }
    const maxBarHeight = Math.max(50, graphHeight * 0.9);
    const minBarHeight = 5;

    details.forEach((detail, i) => {
        const timeMs = (detail.status !== 'skipped' && detail.timeMs) ? detail.timeMs : 0;
        let height = Math.max(minBarHeight, (timeMs / maxTime) * maxBarHeight);
        
        const barContainer = document.createElement('div');
        barContainer.classList.add('bar');
        barContainer.setAttribute('tabindex', '0');
        barContainer.dataset.index = i;
        barContainer.dataset.details = JSON.stringify(detail); // Store details for tooltip

        const barInner = document.createElement('div');
        barInner.classList.add('bar-inner', detail.status);
        barInner.style.height = height + 'px';
        
        const label = document.createElement('div');
        label.classList.add('bar-label');
        label.textContent = `${i + 1}`;

        barContainer.appendChild(barInner);
        barContainer.appendChild(label);
        container.appendChild(barContainer);

        // Add event listeners for tooltips
        barContainer.addEventListener('mouseover', (e) => handleGraphHoverFocus(e, details));
        barContainer.addEventListener('focus', (e) => handleGraphHoverFocus(e, details));
        barContainer.addEventListener('mouseout', hideGraphTooltip);
        barContainer.addEventListener('blur', hideGraphTooltip);
    });
}


function renderDetailResultsTable(tableBody, mobileContainer, details, avgMs) {
    if (!tableBody || !mobileContainer) {
        console.warn("Detail results containers not found.");
        return;
    }

    tableBody.innerHTML = '';
    const mobileHeading = mobileContainer.querySelector('.subheading');
    mobileContainer.innerHTML = '';
    if (mobileHeading) mobileContainer.appendChild(mobileHeading);

    if (details.length === 0) {
        const noDataMsg = '<div style="text-align: center; color: var(--text-secondary); font-style: italic;">No details available.</div>';
        tableBody.innerHTML = `<tr><td colspan="4">${noDataMsg}</td></tr>`;
        mobileContainer.innerHTML += noDataMsg;
        return;
    }

    const fastThreshold = avgMs > 0 ? avgMs * 0.75 : Infinity;
    const slowThreshold = avgMs > 0 ? avgMs * 1.25 : 0;

    details.forEach((qd, i) => {
        const timeMs = qd.timeMs;
        const timeText = qd.status === 'skipped' ? '-' : formatTime(timeMs, true);
        const questionNum = i + 1;
        const userAnswerDisplay = (qd.status === "skipped") ? "-" : (sanitizeHTML(qd.userAnswer) || '-');
        const correctAnswerDisplay = sanitizeHTML(qd.correctAnswer);
        const questionTextDisplay = sanitizeHTML(qd.questionText);
        const difficultyText = qd.difficulty === 'targeted' ? 'Targeted' : (sanitizeHTML(qd.difficulty) || 'N/A');

        let statusPillClass = 'pill-skipped', statusText = 'Skipped';
        if (qd.status === 'correct') { statusPillClass = 'pill-correct'; statusText = 'Correct'; }
        else if (qd.status === 'incorrect') { statusPillClass = 'pill-incorrect'; statusText = 'Incorrect'; }
        const statusPillHTML = `<span class="pill ${statusPillClass}">${statusText}</span>`;

        let speedPillHTML = '';
        if (qd.status !== 'skipped' && avgMs > 0 && timeMs !== null && timeMs >= 0) {
            let speedText = 'Average', speedClass = 'pill-average';
            if (timeMs <= fastThreshold) { speedText = 'Fast'; speedClass = 'pill-fast'; }
            else if (timeMs >= slowThreshold) { speedText = 'Slow'; speedClass = 'pill-slow'; }
            speedPillHTML = ` <span class="pill ${speedClass}">${speedText}</span>`;
        }

        const difficultySpanHTML = (difficultyText !== 'Targeted' && difficultyText !== 'N/A')
            ? `<span style='font-size:0.85em; color:var(--text-secondary); margin-left: 5px;'>[${difficultyText}]</span>`
            : '';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td data-label="Question">Q${questionNum}: ${questionTextDisplay}${difficultySpanHTML} ${statusPillHTML}</td>
            <td data-label="Correct Answer">${correctAnswerDisplay}</td>
            <td data-label="Your Answer">${userAnswerDisplay}</td>
            <td data-label="Time Taken">${timeText}${speedPillHTML}</td>
        `;
        tableBody.appendChild(row);

        const card = document.createElement('div');
        card.className = 'mobile-detail-card';
        card.innerHTML = `
          <div class="mobile-detail-header">
            <div class="mobile-detail-question">Q${questionNum}: ${questionTextDisplay} ${difficultySpanHTML}</div>
            <div class="mobile-detail-status">${statusPillHTML}</div>
          </div>
          <div class="mobile-detail-body">
            <div class="mobile-detail-row">
              <span>Correct Answer:</span>
              <span>${correctAnswerDisplay}</span>
            </div>
            <div class="mobile-detail-row">
              <span>Your Answer:</span>
              <span>${userAnswerDisplay}</span>
            </div>
            <div class="mobile-detail-row">
              <span>Time Taken:</span>
              <span>${timeText}${speedPillHTML}</span>
            </div>
          </div>
        `;
        mobileContainer.appendChild(card);
    });
}


function renderPieChart(container, legendContainer, correct, incorrect, skipped) {
    if (!container || !legendContainer) return;
    const total = correct + incorrect + skipped;
    container.innerHTML = '';
    legendContainer.innerHTML = '';

    if (total === 0) {
        container.innerHTML = '<div class="pie-chart-placeholder" style="color: var(--text-secondary); font-style: italic; padding: 20px 0;">No data for chart.</div>';
        return;
    }

    const percentages = {
        correct: (correct / total) * 100,
        incorrect: (incorrect / total) * 100,
        skipped: (skipped / total) * 100,
    };

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("role", "img");

    const radius = 40, circumference = 2 * Math.PI * radius, strokeWidth = 20;
    let currentAngle = 0;

    const segments = [
        { value: percentages.correct, colorVar: '--pill-correct-bg', label: 'Correct', count: correct },
        { value: percentages.incorrect, colorVar: '--pill-incorrect-bg', label: 'Incorrect', count: incorrect },
        { value: percentages.skipped, colorVar: '--pill-skipped-bg', label: 'Skipped', count: skipped },
    ];

    const computedStyle = getComputedStyle(document.documentElement);

    segments.forEach(segment => {
        if (segment.value <= 0) return;
        const segmentLength = (segment.value / 100) * circumference;
        const dashOffset = circumference - (segmentLength * 0.999);

        const circle = document.createElementNS(svgNS, "circle");
        circle.setAttribute("cx", 50);
        circle.setAttribute("cy", 50);
        circle.setAttribute("r", radius);
        const strokeColor = computedStyle.getPropertyValue(segment.colorVar).trim() || '#ccc';
        circle.setAttribute("stroke", strokeColor);
        circle.setAttribute("stroke-width", strokeWidth);
        circle.setAttribute("stroke-dasharray", `${circumference} ${circumference}`);
        circle.setAttribute("transform", `rotate(${currentAngle} 50 50)`);
        circle.setAttribute("stroke-dashoffset", circumference);
        circle.style.transition = 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        
        svg.appendChild(circle);
        setTimeout(() => { circle.style.strokeDashoffset = dashOffset; }, 50);
        currentAngle += (segment.value / 100) * 360;

        if (segment.count > 0) {
            const legendItem = document.createElement('span');
            legendItem.style.setProperty('--color', strokeColor);
            legendItem.textContent = `${segment.label}: ${segment.count} (${segment.value.toFixed(1)}%)`;
            legendContainer.appendChild(legendItem);
        }
    });

    container.appendChild(svg);
}


function renderDashboard() {
    if (!dashboardArea) return;
    const profile = loadUserPerformance();
    const { globalStats, detailedPerformance, nextReviewSchedule, sessionHistory } = profile;

    // Populate Overall Stats
    const overallStatsContainer = dashboardArea.querySelector('#overall-stats .subcards');
    if (overallStatsContainer) {
        const totalCorrect = Object.values(detailedPerformance).flatMap(Object.values).reduce((sum, s) => sum + s.correct, 0);
        const totalAnsweredForAcc = totalCorrect + Object.values(detailedPerformance).flatMap(Object.values).reduce((sum, s) => sum + s.incorrect, 0);
        const overallAccuracy = totalAnsweredForAcc > 0 ? (totalCorrect / totalAnsweredForAcc) * 100 : 0;

        overallStatsContainer.innerHTML = `
            <div class="result-subcard">
              <div class="hero-number">${overallAccuracy.toFixed(1)}%</div>
              <div class="hero-label">Overall Accuracy</div>
            </div>
            <div class="result-subcard">
              <div class="hero-number">${formatBigNumber(globalStats.totalQuestionsAnswered)}</div>
              <div class="hero-label">Total Answered</div>
            </div>
            <div class="result-subcard">
              <div class="hero-number">${formatBigNumber(globalStats.totalSessions)}</div>
              <div class="hero-label">Total Sessions</div>
            </div>
            <div class="result-subcard">
              <div class="hero-number">${formatTime(globalStats.totalTimePracticed, false)}</div>
              <div class="hero-label">Total Time Practiced</div>
            </div>
             <div class="result-subcard">
              <div class="hero-number">${globalStats.allTimeBestStreak || 0}</div>
              <div class="hero-label">All-Time Best Streak</div>
            </div>
        `;
    }

    const generateRowHTML = (name, stats) => {
        const accuracy = (stats.correct + stats.incorrect > 0) ? (stats.correct / (stats.correct + stats.incorrect)) * 100 : 0;
        const avgTime = stats.correct > 0 ? stats.totalTimeCorrect / stats.correct : 0;
        const mastery = stats.mastery || 0;
        return `
            <tr>
                <td class="type-name">${name}</td>
                <td>${accuracy.toFixed(1)}%</td>
                <td>
                    <div class="mastery-bar-container" title="Mastery: ${(mastery * 100).toFixed(1)}%">
                        <div class="mastery-bar" style="width: ${mastery * 100}%;"></div>
                    </div>
                </td>
                <td>${formatTime(avgTime, true)}</td>
            </tr>
        `;
    };

    const typeTableBody = dashboardArea.querySelector('#type-performance-table tbody');
    if (typeTableBody) {
        typeTableBody.innerHTML = '';
        questionTypes.forEach(type => {
            const typeStats = Object.values(detailedPerformance[type] || {}).reduce((acc, diffStats) => {
                acc.correct += diffStats.correct;
                acc.incorrect += diffStats.incorrect;
                acc.totalTimeCorrect += diffStats.totalTimeCorrect;
                acc.totalAttempts += diffStats.totalAttempts;
                return acc;
            }, { correct: 0, incorrect: 0, totalTimeCorrect: 0, totalAttempts: 0 });

            typeStats.mastery = typeStats.totalAttempts > 0 ? typeStats.correct / typeStats.totalAttempts : 0;

            if (typeStats.totalAttempts > 0) {
                const name = type.replace('cbrt', 'Cube Root').replace('sqrt', 'Square Root');
                typeTableBody.innerHTML += generateRowHTML(name, typeStats);
            }
        });
    }

    const diffTableBody = dashboardArea.querySelector('#difficulty-performance-table tbody');
    if (diffTableBody) {
        diffTableBody.innerHTML = '';
        difficultyLevels.forEach(diff => {
             const diffStats = questionTypes.reduce((acc, type) => {
                const stats = detailedPerformance[type]?.[diff];
                if(stats) {
                    acc.correct += stats.correct;
                    acc.incorrect += stats.incorrect;
                    acc.totalTimeCorrect += stats.totalTimeCorrect;
                    acc.totalAttempts += stats.totalAttempts;
                }
                return acc;
            }, { correct: 0, incorrect: 0, totalTimeCorrect: 0, totalAttempts: 0 });

             diffStats.mastery = diffStats.totalAttempts > 0 ? diffStats.correct / diffStats.totalAttempts : 0;

             if (diffStats.totalAttempts > 0) {
                diffTableBody.innerHTML += generateRowHTML(diff, diffStats);
            }
        });
    }

    const reviewItemsContainer = dashboardArea.querySelector('#review-items');
    const reviewMessage = dashboardArea.querySelector('#review-message');
    if (reviewItemsContainer && reviewMessage) {
        reviewItemsContainer.innerHTML = '';
        const now = new Date();
        const upcomingReviews = [];
        for (const type in nextReviewSchedule) {
            for (const difficulty in nextReviewSchedule[type]) {
                const reviewDate = new Date(nextReviewSchedule[type][difficulty]);
                if (reviewDate <= now) {
                    upcomingReviews.push({ type, difficulty, date: reviewDate });
                }
            }
        }

        if (upcomingReviews.length > 0) {
            reviewMessage.textContent = "These topics are ready for review to strengthen your mastery!";
            upcomingReviews
                .sort((a,b) => a.date - b.date)
                .forEach(item => {
                    const name = `${item.difficulty} ${item.type}`.replace('cbrt', 'Cube Root').replace('sqrt', 'Square Root');
                    const reviewCard = document.createElement('div');
                    reviewCard.className = 'result-subcard';
                    reviewCard.innerHTML = `<div class="hero-label" style="font-weight: 600; text-transform: capitalize;">${name}</div><div class="review-time">Review now</div>`;
                    reviewItemsContainer.appendChild(reviewCard);
                });
        } else {
            reviewMessage.textContent = "Great job! No topics are currently due for review.";
        }
    }
    
    // NEW: Call functions to render new dashboard components
    renderPerformanceTrendChart(sessionHistory);
    renderDashboardInsights(profile);
}


/* ---------------------------------------
   GRAPH TOOLTIP FUNCTIONS
---------------------------------------- */
function handleGraphHoverFocus(event, details) {
    if (window.innerWidth <= 600) return;
    const barElement = event.currentTarget;
    const index = parseInt(barElement.dataset.index, 10);
    if (isNaN(index) || !details || index < 0 || index >= details.length) return;
    const detail = details[index];
    showGraphTooltip(detail, index + 1, barElement, event);
}

function showGraphTooltip(detail, questionNum, targetElement, event) {
    if (!graphTooltipEl) return;
    const timeText = detail.status === 'skipped' ? '-' : formatTime(detail.timeMs, true);
    const userAnswerDisplay = (detail.status === "skipped") ? "-" : (sanitizeHTML(detail.userAnswer) || '-');
    const correctAnswerDisplay = sanitizeHTML(detail.correctAnswer);
    const questionTextDisplay = sanitizeHTML(detail.questionText);
    const difficultyText = detail.difficulty === 'targeted' ? 'Targeted' : (sanitizeHTML(detail.difficulty) || 'N/A');
    const difficultySpanHTML = (difficultyText !== 'Targeted' && difficultyText !== 'N/A') ? ` [${difficultyText}]` : '';

    let statusPillClass = 'pill-skipped', statusText = 'Skipped';
    if (detail.status === 'correct') { statusPillClass = 'pill-correct'; statusText = 'Correct'; }
    else if (detail.status === 'incorrect') { statusPillClass = 'pill-incorrect'; statusText = 'Incorrect'; }
    const statusPillHTML = `<span class="pill ${statusPillClass}">${statusText}</span>`;

    graphTooltipEl.innerHTML = `
        <div><strong>Q${questionNum}:</strong> ${questionTextDisplay}${difficultySpanHTML}</div>
        <div><strong>Status:</strong> ${statusPillHTML}</div>
        <div><strong>Correct:</strong> ${correctAnswerDisplay}</div>
        <div><strong>Yours:</strong> ${userAnswerDisplay}</div>
        <div><strong>Time:</strong> ${timeText}</div>
    `;
    updateTooltipPosition(event, targetElement);
    graphTooltipEl.classList.add('tooltip-visible');
}

function hideGraphTooltip() {
    if (graphTooltipEl) {
        graphTooltipEl.classList.remove('tooltip-visible');
    }
}

function updateTooltipPosition(event, targetElement) {
    if (!graphTooltipEl || !event) return;
    const PADDING = 15;
    let x, y;
    if (event.type.includes('mouse') && event.clientX && event.clientY) {
         x = event.clientX + PADDING;
         y = event.clientY + PADDING;
    } else if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        x = rect.left + window.scrollX;
        let tooltipHeight = graphTooltipEl.offsetHeight;
        if(tooltipHeight === 0) {
            graphTooltipEl.style.visibility = 'hidden';
            graphTooltipEl.style.display = 'block';
            tooltipHeight = graphTooltipEl.offsetHeight;
            graphTooltipEl.style.visibility = '';
            graphTooltipEl.style.display = '';
        }
        tooltipHeight = tooltipHeight || 50;
        y = rect.top + window.scrollY - PADDING - tooltipHeight;
        if (y < window.scrollY + PADDING) {
             y = rect.bottom + window.scrollY + PADDING;
        }
    } else {
        return;
    }
    const tooltipRect = graphTooltipEl.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width || 200;
    const tooltipHeight = tooltipRect.height || 50;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const currentScrollX = window.scrollX;
    const currentScrollY = window.scrollY;

    if (x + tooltipWidth + PADDING > vw + currentScrollX) {
        x = vw + currentScrollX - tooltipWidth - PADDING;
    }
    if (x < currentScrollX + PADDING) {
        x = currentScrollX + PADDING;
    }
    if (y + tooltipHeight + PADDING > vh + currentScrollY) {
         if (event.type.includes('mouse') && event.clientY) {
             y = event.clientY + currentScrollY - tooltipHeight - PADDING;
         } else if (targetElement) {
             const rect = targetElement.getBoundingClientRect();
             y = rect.top + currentScrollY - tooltipHeight - PADDING;
         } else {
             y = vh + currentScrollY - tooltipHeight - PADDING;
         }
    }
    if (y < currentScrollY + PADDING) {
        y = currentScrollY + PADDING;
    }
    graphTooltipEl.style.left = `${x}px`;
    graphTooltipEl.style.top = `${y}px`;
}

/* ---------------------------------------
   RESIZE HANDLING & RESPONSIVENESS
---------------------------------------- */
 let resizeTimeout;
function handleResize() {
    const isMobile = window.innerWidth <= 600;
    if (!pageTab || !hamburgerBtn || !mainNav || !resultCard || !infoContainer || !infoButton || !timeGraphContainer || !summaryPieChartContainer) {
        return;
    }

    if (!isMobile && mainNav.classList.contains('active')) {
        closeNavMenu();
    }

    if (currentArea === 'practice-area') {
        if (isMobile) {
            infoContainer.style.display = 'none';
        } else {
            infoContainer.style.display = sessionActive ? 'none' : 'flex';
        }
    } else {
        infoContainer.style.display = 'none';
    }

    if (currentArea === 'practice-area' && !sessionActive && resultCard.classList.contains('active')) {
       renderTimeGraph(timeGraphContainer, sessionDetails);
       renderPieChart(summaryPieChartContainer, summaryPieChartLegend, correctCount, incorrectCount, skippedCount);
    }

    hideInfo();
    hideGraphTooltip();
}

window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResize, 100);
});

/* ---------------------------------------
   INFO TOOLTIP/MODAL LOGIC
---------------------------------------- */
 function showInfo() {
     if (sessionActive && currentArea === 'practice-area') return;
     closeNavMenu();

     if (window.innerWidth <= 600) {
         if(infoModalOverlay) infoModalOverlay.classList.add('modal-visible');
         if(infoModalCloseBtn) setTimeout(() => infoModalCloseBtn.focus(), 50);
     } else {
         if (currentArea === 'practice-area' && !sessionActive) {
             if (infoTooltip) infoTooltip.classList.add('tooltip-visible');
             if (infoButton) infoButton.setAttribute('aria-expanded', 'true');
         } else {
              if(infoModalOverlay) infoModalOverlay.classList.add('modal-visible');
              if(infoModalCloseBtn) setTimeout(() => infoModalCloseBtn.focus(), 50);
         }
     }
 }

 function hideInfo() {
     if (infoTooltip) infoTooltip.classList.remove('tooltip-visible');
     if (infoModalOverlay) infoModalOverlay.classList.remove('modal-visible');
     if (infoButton) infoButton.setAttribute('aria-expanded', 'false');
 }

 if (infoButton) {
     infoButton.addEventListener('click', (event) => {
         if (currentArea !== 'practice-area' || sessionActive || window.innerWidth <= 600) return;
         event.stopPropagation();
         const isExpanded = infoButton.getAttribute('aria-expanded') === 'true';
         if (isExpanded) hideInfo();
         else showInfo();
     });
 }

 if (infoModalCloseBtn) infoModalCloseBtn.addEventListener('click', hideInfo);

 if (infoModalOverlay) {
     infoModalOverlay.addEventListener('click', (event) => {
         if (event.target === infoModalOverlay) hideInfo();
     });
 }

 if(infoContainer && infoTooltip && infoButton) {
     let leaveTimeout;
     infoContainer.addEventListener('mouseenter', () => {
         clearTimeout(leaveTimeout);
         if (currentArea === 'practice-area' && window.innerWidth > 600 && !sessionActive && !infoTooltip.classList.contains('tooltip-visible') && mainNav && !mainNav.classList.contains('active')) {
             showInfo();
         }
     });
     infoContainer.addEventListener('mouseleave', () => {
         leaveTimeout = setTimeout(() => {
            if (window.innerWidth > 600 && !infoContainer.contains(document.activeElement)) {
                hideInfo();
            }
         }, 150);
     });
     infoContainer.addEventListener('focusin', () => {
          clearTimeout(leaveTimeout);
         if (currentArea === 'practice-area' && window.innerWidth > 600 && !sessionActive && !infoTooltip.classList.contains('tooltip-visible') && mainNav && !mainNav.classList.contains('active')) {
             showInfo();
         }
     });
     infoContainer.addEventListener('focusout', (event) => {
         setTimeout(() => {
             const targetIsInside = infoContainer.contains(event.relatedTarget) || infoTooltip.contains(event.relatedTarget);
            if (window.innerWidth > 600 && !targetIsInside) {
                hideInfo();
            }
         }, 50);
     });
 }

  window.addEventListener('scroll', hideGraphTooltip, true);

/* ---------------------------------------
   KEYBOARD SHORTCUTS
---------------------------------------- */
document.addEventListener('keydown', (event) => {
    const targetIsInput = event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA';
    const isSessionAnswerInputFocused = document.activeElement === sessionAnswerInput;
    const isStudyJumpInputFocused = studyArea && document.activeElement === studyArea.querySelector('#jump-to-input');

    if (event.key === 'Escape') {
         event.preventDefault();
         let closedSomething = false;
         if (mainNav?.classList.contains('active')) {
             closeNavMenu();
             hamburgerBtn?.focus();
             console.log("Shortcut: Esc Close Nav Menu");
             closedSomething = true;
         }
         else if ((infoModalOverlay?.classList.contains('modal-visible')) || (infoTooltip?.classList.contains('tooltip-visible'))) {
            hideInfo();
            if (window.innerWidth > 600 && currentArea === 'practice-area' && !sessionActive) infoButton?.focus();
            console.log("Shortcut: Esc Close Info");
            closedSomething = true;
        }
         else if (graphTooltipEl?.classList.contains('tooltip-visible')) {
             hideGraphTooltip();
             console.log("Shortcut: Esc Close Graph Tooltip");
             closedSomething = true;
         }
          if (!closedSomething && sessionActive && currentArea === 'practice-area') {
             sessionAnswerInput?.focus();
             console.log("Shortcut: Esc Focus Answer Input");
         } else if (!closedSomething && currentArea === 'study-area') {
             if(isStudyJumpInputFocused) event.target.blur();
         }
    }
    else if (sessionActive && currentArea === 'practice-area') {
        if (event.key.toLowerCase() === 's' && !isAutoSubmitting) {
             event.preventDefault();
             skipQuestion();
             console.log("Shortcut: Skip");
        }
    }
    else if (!targetIsInput) {
         if (event.key.toLowerCase() === 't') {
             event.preventDefault();
             toggleMode();
             console.log("Shortcut: Toggle Theme");
         }
         else if (event.key === '?' || event.key.toLowerCase() === 'i') {
             if (!(sessionActive && currentArea === 'practice-area')) {
                 event.preventDefault();
                 const infoVisible = (infoModalOverlay?.classList.contains('modal-visible')) || (infoTooltip?.classList.contains('tooltip-visible'));
                 if (infoVisible) {
                     hideInfo();
                     console.log("Shortcut: Hide Info");
                 } else {
                     showInfo();
                     console.log("Shortcut: Show Info");
                 }
             }
         }
    }
});


/* ---------------------------------------
   PLAY AGAIN FUNCTIONALITY
---------------------------------------- */
function resetToMainScreen() {
    console.log("Resetting to main practice screen...");
    if (sessionActive) endSession();
    sessionActive = false;
    clearTimeout(sessionTimerId);
    sessionTimerId = null;
    isAutoSubmitting = false;
    currentQuestion = null;

    if (!mainCard || !sessionCard || !resultCard) {
        console.error("Cannot reset: Main/Session/Result card not found.");
        return;
    }

    showArea('practice-area');
    mainCard.style.display = 'block';
    sessionCard.style.display = 'none';
    sessionCard.classList.remove('active');
    resultCard.style.display = 'none';
    resultCard.classList.remove('active');

    showSection('section1');
    handleResize();
    closeNavMenu();

     const accuracyEl = document.getElementById('accuracyNumber');
     const correctEl = document.getElementById('correctNumber');
     const incorrectEl = document.getElementById('incorrectNumber');
     const skippedEl = document.getElementById('skippedNumber');
     const avgTimeEl = document.getElementById('avgTimeNumber');
     const fastestEl = document.getElementById('fastestNumber');
     const slowestEl = document.getElementById('slowestNumber');

     if(accuracyEl) accuracyEl.textContent = '0%';
     if(correctEl) correctEl.textContent = '0';
     if(incorrectEl) incorrectEl.textContent = '0';
     if(skippedEl) skippedEl.textContent = '0';
     if(challengeScoreContainer) challengeScoreContainer.classList.remove('active');
     if(avgTimeEl) avgTimeEl.textContent = '0s';
     if(fastestEl) fastestEl.textContent = '0s';
     if(slowestEl) slowestEl.textContent = '0s';
     if(streakNumberEl) streakNumberEl.textContent = '0';
     if(totalTimeNumberEl) totalTimeNumberEl.textContent = '0s';
     if (timeGraphContainer) timeGraphContainer.innerHTML = '<div style="color: var(--text-secondary); font-style: italic; padding-left: 10px;">No time data yet.</div>';
     if (detailTableBody) detailTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); font-style: italic;">No details yet.</td></tr>';
     if (mobileDetailContainer) mobileDetailContainer.innerHTML = '<div class="subheading">Detailed Results</div><div style="text-align: center; color: var(--text-secondary); font-style: italic;">No details yet.</div>';
    if (summaryPieChartContainer) summaryPieChartContainer.innerHTML = '<div class="pie-chart-placeholder" style="color: var(--text-secondary); font-style: italic; padding: 20px 0;"></div>';
    if (summaryPieChartLegend) summaryPieChartLegend.innerHTML = '';

    mainCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const firstSectionBtn = document.getElementById('btn-section1');
    if (firstSectionBtn) setTimeout(() => firstSectionBtn.focus(), 100);
}


/* =======================================
   STUDY AREA JAVASCRIPT LOGIC
======================================== */
function initializeStudyArea() {
    console.log("Initializing Study Area...");
    const MULTIPLICATION_LIMIT = 50;
    const MULTIPLICATION_DEPTH = 10;
    const SQUARES_LIMIT = 50;
    const CUBES_LIMIT = 30;
    const JUMP_TO_DEBOUNCE_DELAY = 300;

    const studyContainer = studyArea.querySelector('.study-container');
    const tabButtonsStudy = studyArea.querySelectorAll('.tab-button');
    const tabContentsStudy = studyArea.querySelectorAll('.tab-content');
    const multiplicationContainerStudy = studyArea.querySelector('#multiplication-tables-grid');
    const squaresContainerStudy = studyArea.querySelector('#squares-tables-grid');
    const cubesContainerStudy = studyArea.querySelector('#cubes-tables-grid');
    const jumpToInputStudy = studyArea.querySelector('#jump-to-input');
    const toggleAnswersBtnStudy = studyArea.querySelector('#toggle-answers-btn');

    if (!studyContainer || tabButtonsStudy.length === 0 || tabContentsStudy.length === 0 || !multiplicationContainerStudy || !squaresContainerStudy || !cubesContainerStudy || !jumpToInputStudy || !toggleAnswersBtnStudy) {
         console.error("Study Area Initialization Failed: Missing required elements.");
         studyArea.innerHTML = `<div class='study-container' style='text-align: center; padding: 40px;'><h2>Error</h2><p style='color: var(--text-secondary);'>Could not load study materials. Required components are missing.</p></div>`;
         return;
    }

    const debounceStudy = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    tabButtonsStudy.forEach(button => {
        button.addEventListener('click', () => {
            const targetTabId = button.getAttribute('data-tab');
            const targetTabContent = studyArea.querySelector(`#${targetTabId}`);
            if (!targetTabContent) return;
            tabButtonsStudy.forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-selected', 'false');
            });
            tabContentsStudy.forEach(content => {
                content.classList.remove('active');
                const highlightedItem = content.querySelector('.highlighted');
                if (highlightedItem) {
                    highlightedItem.classList.remove('highlighted');
                }
            });
            button.classList.add('active');
            button.setAttribute('aria-selected', 'true');
            targetTabContent.classList.add('active');
            try {
               localStorage.setItem('activeMathTab', targetTabId);
            } catch(e){ console.warn("Could not save study tab preference."); }
        });
    });

    function generateMultiplicationTablesStudy() {
        let html = '';
        for (let i = 1; i <= MULTIPLICATION_LIMIT; i++) {
            html += `<div class="table-block" data-number="${i}" id="table-${i}">`;
            html += `<h3>Table of ${i}</h3>`;
            for (let j = 1; j <= MULTIPLICATION_DEPTH; j++) {
                html += `<p>${i} × ${j} = <span class="answer-value">${i * j}</span></p>`;
            }
            html += `</div>`;
        }
        multiplicationContainerStudy.innerHTML = html;
    }

    function generateSquaresStudy() {
        let html = '';
        for (let i = 1; i <= SQUARES_LIMIT; i++) {
            html += `<div class="value-item"><p>${i}<sup>2</sup> = <span class="answer-value">${i * i}</span></p></div>`;
        }
        squaresContainerStudy.innerHTML = html;
    }

    function generateCubesStudy() {
        let html = '';
        for (let i = 1; i <= CUBES_LIMIT; i++) {
            html += `<div class="value-item"><p>${i}<sup>3</sup> = <span class="answer-value">${i * i * i}</span></p></div>`;
        }
        cubesContainerStudy.innerHTML = html;
    }

    const handleJumpToStudy = debounceStudy(() => {
        let tableNumber = parseInt(jumpToInputStudy.value, 10);
         const multTabButton = studyArea.querySelector('.tab-button[data-tab="multiplication"]');
         if (!multTabButton || !multTabButton.classList.contains('active')) {
             console.log("Jump-to only works on Multiplication tab.");
             return;
         }
        if (isNaN(tableNumber)) {
            return;
        } else if (tableNumber < 1) {
            tableNumber = 1;
            jumpToInputStudy.value = '1';
        } else if (tableNumber > MULTIPLICATION_LIMIT) {
            tableNumber = MULTIPLICATION_LIMIT;
            jumpToInputStudy.value = MULTIPLICATION_LIMIT;
        }
        const targetTable = studyArea.querySelector(`#table-${tableNumber}`);
        if (targetTable) {
            targetTable.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetTable.style.transition = 'background-color 0.5s ease, box-shadow 0.5s ease';
            const originalBg = getComputedStyle(targetTable).backgroundColor;
             const computedStyle = getComputedStyle(document.documentElement);
             const shadowDark = computedStyle.getPropertyValue('--shadow-dark').trim();
             const shadowLight = computedStyle.getPropertyValue('--shadow-light').trim();
             const highlightShadow = `inset 4px 4px 8px ${shadowDark}, inset -4px -4px 8px ${shadowLight}, 5px 5px 10px ${shadowDark}, -5px -5px 10px ${shadowLight}`;
             const originalShadow = getComputedStyle(targetTable).boxShadow;
             targetTable.style.backgroundColor = 'rgba(128, 128, 128, 0.15)';
             targetTable.style.boxShadow = highlightShadow;
            setTimeout(() => {
                targetTable.style.backgroundColor = originalBg;
                targetTable.style.boxShadow = originalShadow;
                 setTimeout(() => {
                     targetTable.style.transition = '';
                     targetTable.style.backgroundColor = '';
                     targetTable.style.boxShadow = '';
                 }, 500);
            }, 1200);
        }
    }, JUMP_TO_DEBOUNCE_DELAY);

    jumpToInputStudy.addEventListener('input', handleJumpToStudy);
     jumpToInputStudy.addEventListener('keypress', (event) => {
         if (event.key === 'Enter') {
             event.preventDefault();
             handleJumpToStudy();
         }
     });

     toggleAnswersBtnStudy.addEventListener('click', () => {
        const currentState = toggleAnswersBtnStudy.getAttribute('data-state');
        if (currentState === 'shown') {
            studyArea.classList.add('answers-hidden');
            toggleAnswersBtnStudy.textContent = 'Show Answers';
            toggleAnswersBtnStudy.setAttribute('data-state', 'hidden');
        } else {
            studyArea.classList.remove('answers-hidden');
            toggleAnswersBtnStudy.textContent = 'Hide Answers';
            toggleAnswersBtnStudy.setAttribute('data-state', 'shown');
        }
     });

    function handleHighlightClickStudy(event) {
        const target = event.target;
        const clickableItem = target.closest('#study-area .table-block p, #study-area .value-item');
        if (clickableItem) {
            let itemToHighlight = clickableItem;
            const parentContainer = itemToHighlight.closest('.tab-content');
            if (!parentContainer) return;
            const currentlyHighlighted = parentContainer.querySelector('.highlighted');
            let clickedExistingHighlight = (currentlyHighlighted === itemToHighlight);
            if (currentlyHighlighted) {
                currentlyHighlighted.classList.remove('highlighted');
            }
            if (!clickedExistingHighlight) {
                itemToHighlight.classList.add('highlighted');
            }
        }
    }

    if(multiplicationContainerStudy) multiplicationContainerStudy.addEventListener('click', handleHighlightClickStudy);
    if(squaresContainerStudy) squaresContainerStudy.addEventListener('click', handleHighlightClickStudy);
    if(cubesContainerStudy) cubesContainerStudy.addEventListener('click', handleHighlightClickStudy);

    function setupStudyArea() {
        const lastTab = localStorage.getItem('activeMathTab');
        const defaultActiveButtonStudy = studyArea.querySelector('.tab-button.active');
        const defaultActiveContentStudy = studyArea.querySelector('.tab-content.active');

        if(defaultActiveButtonStudy) {
            defaultActiveButtonStudy.classList.remove('active');
            defaultActiveButtonStudy.setAttribute('aria-selected', 'false');
        }
        if(defaultActiveContentStudy) defaultActiveContentStudy.classList.remove('active');

        let tabToActivate = lastTab || 'multiplication';
        const lastActiveButtonStudy = studyArea.querySelector(`.tab-button[data-tab="${tabToActivate}"]`);
        const lastActiveContentStudy = studyArea.querySelector(`#${tabToActivate}`);

         if(lastActiveButtonStudy && lastActiveContentStudy) {
             lastActiveButtonStudy.classList.add('active');
             lastActiveButtonStudy.setAttribute('aria-selected', 'true');
             lastActiveContentStudy.classList.add('active');
         } else {
             const firstTabButton = studyArea.querySelector('.tab-button');
             const firstTabContent = studyArea.querySelector('.tab-content');
             if(firstTabButton) {
                 firstTabButton.classList.add('active');
                 firstTabButton.setAttribute('aria-selected', 'true');
             }
              if(firstTabContent) firstTabContent.classList.add('active');
         }
        generateMultiplicationTablesStudy();
        generateSquaresStudy();
        generateCubesStudy();
        console.log("Study Area Content Generated.");
    }
    setupStudyArea();
}


 /* =======================================
   GLOBAL BACK TO TOP LOGIC
======================================== */
function initializeBackToTop() {
    const SCROLL_THRESHOLD_FOR_BACK_TO_TOP = 300;
    if (!backToTopBtnGlobal) return;

    window.addEventListener('scroll', () => {
       if (window.scrollY > SCROLL_THRESHOLD_FOR_BACK_TO_TOP) {
           backToTopBtnGlobal.classList.add('visible');
       } else {
           backToTopBtnGlobal.classList.remove('visible');
       }
    });
    backToTopBtnGlobal.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    console.log("Back to Top Initialized.");
}


/* =======================================
   NEW REVIEW AREA & DASHBOARD FUNCTIONS
======================================== */
function renderSessionHistoryList() {
    if (!sessionListContainer) return;
    const profile = loadUserPerformance();
    sessionListContainer.innerHTML = '';

    if (profile.sessionHistory.length === 0) {
        sessionListContainer.innerHTML = `<p style="color: var(--text-secondary); font-style: italic;">Your past practice sessions will appear here.</p>`;
        return;
    }

    profile.sessionHistory.forEach(session => {
        const item = document.createElement('div');
        item.className = 'session-list-item';
        item.setAttribute('tabindex', '0');
        item.setAttribute('role', 'button');
        item.dataset.sessionId = session.sessionId;

        const date = new Date(session.startTime);
        const formattedDate = date.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
        });
        
        const modeText = (session.settings.mode || 'Practice').replace('section', 'Mode ');

        item.innerHTML = `
            <div class="session-list-info">
                <div class="date">${formattedDate}</div>
                <div class="mode">${modeText}</div>
            </div>
            <div class="session-list-stats">
                <div class="stat"><span class="label">🎯</span>${session.summary.accuracy.toFixed(1)}%</div>
                <div class="stat"><span class="label">📈</span>${session.maxStreak}</div>
                <div class="stat"><span class="label">⏱️</span>${formatTime(session.summary.durationMs, false)}</div>
            </div>
        `;
        item.addEventListener('click', () => showSessionReviewDetail(session.sessionId));
        item.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.key === ' ') showSessionReviewDetail(session.sessionId);
        });
        sessionListContainer.appendChild(item);
    });
}

function showSessionReviewDetail(sessionId) {
    const profile = loadUserPerformance();
    const sessionData = profile.sessionHistory.find(s => s.sessionId === sessionId);
    if (!sessionData) {
        alert("Error: Could not find session data.");
        return;
    }

    if (reviewListCard) reviewListCard.style.display = 'none';
    if (reviewDetailCard) {
        reviewDetailCard.dataset.sessionId = sessionId; // Store for theme changes
        reviewDetailCard.style.display = 'block';
        reviewDetailCard.setAttribute('aria-hidden', 'false');
    }

    const detailTitle = document.getElementById('reviewDetailTitle');
    if(detailTitle) detailTitle.textContent = `Review of Session from ${new Date(sessionData.startTime).toLocaleDateString()}`;

    renderResults(sessionData, 'review');
    reviewDetailCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showReviewList() {
    if (reviewDetailCard) {
        reviewDetailCard.style.display = 'none';
        reviewDetailCard.setAttribute('aria-hidden', 'true');
    }
    if (reviewListCard) {
        reviewListCard.style.display = 'block';
        reviewListCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function renderPerformanceTrendChart(sessionHistory) {
    const container = document.getElementById('performanceTrendChart');
    if (!container) return;

    const history = [...sessionHistory].reverse(); // Chart from oldest to newest
    if (history.length < 2) {
        container.innerHTML = `<div style="color: var(--text-secondary); font-style: italic; padding: 20px;">Complete at least two sessions to see your progress trends.</div>`;
        return;
    }
    container.innerHTML = ''; // Clear placeholder

    const accuracies = history.map(s => s.summary.accuracy);
    const avgTimes = history.map(s => {
        const validTimes = s.details.filter(d => d.timeMs !== null).map(d => d.timeMs);
        return validTimes.length > 0 ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length : 0;
    });

    const maxAvgTime = Math.max(...avgTimes, 1);
    const graphHeight = container.clientHeight || 200;
    const maxBarHeight = graphHeight * 0.9;
    const minBarHeight = 2;
    
    // Simple bar chart visualization
    history.forEach((session, i) => {
        const accuracyHeight = Math.max(minBarHeight, (accuracies[i] / 100) * maxBarHeight);
        const timeHeight = Math.max(minBarHeight, (avgTimes[i] / maxAvgTime) * maxBarHeight);

        const barGroup = document.createElement('div');
        barGroup.classList.add('bar');
        barGroup.style.flexDirection = 'row';
        barGroup.style.gap = '2px';
        barGroup.setAttribute('tabindex', '0');
        barGroup.setAttribute('aria-label', `Session ${i+1}: Accuracy ${accuracies[i].toFixed(1)}%, Avg. Time ${formatTime(avgTimes[i])}`);

        // Accuracy bar
        const accBar = document.createElement('div');
        accBar.classList.add('bar-inner', 'correct');
        accBar.style.height = `${accuracyHeight}px`;
        accBar.style.width = '8px';
        accBar.title = `Accuracy: ${accuracies[i].toFixed(1)}%`;
        
        // Time bar
        const timeBar = document.createElement('div');
        timeBar.classList.add('bar-inner');
        timeBar.style.backgroundColor = 'var(--mastery-color)';
        timeBar.style.height = `${timeHeight}px`;
        timeBar.style.width = '8px';
        timeBar.title = `Avg. Time: ${formatTime(avgTimes[i])}`;
        
        const label = document.createElement('div');
        label.classList.add('bar-label');
        label.textContent = i + 1;

        const barContainer = document.createElement('div');
        barContainer.style.display = 'flex';
        barContainer.style.flexDirection = 'column';
        barContainer.style.alignItems = 'center';
        
        barGroup.appendChild(accBar);
        barGroup.appendChild(timeBar);
        barContainer.appendChild(barGroup);
        barContainer.appendChild(label);
        container.appendChild(barContainer);
    });
}

function getAchievements(profile) {
    const achievements = [];
    const { globalStats, detailedPerformance } = profile;

    if (globalStats.totalQuestionsAnswered >= 100) achievements.push('Rookie');
    if (globalStats.totalQuestionsAnswered >= 500) achievements.push('Veteran');
    if (globalStats.allTimeBestStreak >= 10) achievements.push('Streak 10');
    if (globalStats.allTimeBestStreak >= 25) achievements.push('On Fire');

    for (const type in detailedPerformance) {
        for (const diff in detailedPerformance[type]) {
            const item = detailedPerformance[type][diff];
            if (item.mastery >= 0.9) {
                achievements.push(`Mastered ${diff} ${type}`);
                return achievements;
            }
        }
    }
    return achievements;
}

function renderDashboardInsights(profile) {
    const container = document.getElementById('insights-container');
    const achContainer = document.getElementById('achievements-container');
    if (!container || !achContainer) return;

    const insights = [];
    const { detailedPerformance, globalStats } = profile;

    // Insight 1: Find weakest area
    let weakest = { mastery: 1, name: '' };
    for (const type in detailedPerformance) {
        for (const diff in detailedPerformance[type]) {
            const item = detailedPerformance[type][diff];
            if (item.mastery < weakest.mastery && item.totalAttempts > 5) {
                weakest = { mastery: item.mastery, name: `${diff} ${type}` };
            }
        }
    }
    if (weakest.mastery < 0.7) {
        insights.push(`Your biggest opportunity for improvement is in <strong>${weakest.name}</strong>. Try a 'Targeted' or 'Adaptive' session to focus on it.`);
    }

    // Insight 2: Speed vs Accuracy
    const timedModes = profile.sessionHistory.filter(s => s.settings.timeLimit > 0);
    const fixedModes = profile.sessionHistory.filter(s => s.settings.timeLimit === 0);
    if (timedModes.length > 2 && fixedModes.length > 2) {
        const timedAcc = timedModes.reduce((a,b) => a + b.summary.accuracy, 0) / timedModes.length;
        const fixedAcc = fixedModes.reduce((a,b) => a + b.summary.accuracy, 0) / fixedModes.length;
        if (timedAcc > 85 && Math.abs(timedAcc - fixedAcc) < 5) {
             insights.push("You perform well under pressure! Your accuracy remains high in timed modes.");
        } else if (fixedAcc > timedAcc + 10) {
            insights.push("You're very accurate, but the clock adds pressure. Try 'Fixed Time' mode with easier questions to build speed and confidence.");
        }
    }

    // Render insights
    if (insights.length > 0) {
        container.innerHTML = insights.map(insight => `<div class="result-subcard" style="flex-basis: 100%; text-align: left; align-items: flex-start;"><p>${insight}</p></div>`).join('');
    } else {
        container.innerHTML = `<p style="text-align: left; color: var(--text-secondary); width: 100%;">Personalized tips and achievements will appear here as you practice.</p>`;
    }

    const achievements = getAchievements(profile);
    achContainer.innerHTML = achievements.map(a => `<span class="badge" title="Achievement">${a}</span>`).join('');
}


/* ---------------------------------------
   INITIALIZATION
---------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Fully Loaded.");
    applySavedTheme();
    showArea('dashboard-area'); // Start on dashboard
    initializeStudyArea();
    initializeBackToTop();

    if (practiceArea) {
        updateTargetedInputs();
        updateTargetedLimitInput();
    }

    if (summaryPieChartContainer) summaryPieChartContainer.innerHTML = '<div class="pie-chart-placeholder" style="color: var(--text-secondary); font-style: italic; padding: 20px 0;"></div>';
    if (summaryPieChartLegend) summaryPieChartLegend.innerHTML = '';

    if (practiceArea && mainCard) mainCard.style.display = 'block';
    if (sessionCard) sessionCard.style.display = 'none';
    if (resultCard) resultCard.style.display = 'none';

    if (themeToggleButton) {
        themeToggleButton.addEventListener('click', toggleMode);
    } else {
        console.error("Theme toggle button not found!");
    }

    console.log("Mathex App Initialized.");
});
