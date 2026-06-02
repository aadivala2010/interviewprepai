const GEMINI_PROXY_ENDPOINT = "/api/gemini";
const STORAGE_KEY = "interviewprep-sessions";
let pdfjsLibPromise = null;
let mammothPromise = null;

const state = {
  resumeText: "",
  resumeAnalysis: null,
  setup: null,
  questions: [],
  responses: [],
  currentQuestionIndex: 0,
  currentFeedbackIndex: null,
  finalReport: null,
};

const els = {
  setupView: document.getElementById("setupView"),
  practiceView: document.getElementById("practiceView"),
  reportView: document.getElementById("reportView"),
  uploadTab: document.getElementById("uploadTab"),
  pasteTab: document.getElementById("pasteTab"),
  resumeFile: document.getElementById("resumeFile"),
  fileMeta: document.getElementById("fileMeta"),
  resumeText: document.getElementById("resumeText"),
  jobDescription: document.getElementById("jobDescription"),
  companyName: document.getElementById("companyName"),
  jobTitle: document.getElementById("jobTitle"),
  interviewType: document.getElementById("interviewType"),
  difficulty: document.getElementById("difficulty"),
  questionCount: document.getElementById("questionCount"),
  generateBtn: document.getElementById("generateBtn"),
  generationMessage: document.getElementById("generationMessage"),
  setupStatus: document.getElementById("setupStatus"),
  railInterviewType: document.getElementById("railInterviewType"),
  railDifficulty: document.getElementById("railDifficulty"),
  railQuestionCount: document.getElementById("railQuestionCount"),
  railRoleTitle: document.getElementById("railRoleTitle"),
  railCompanyName: document.getElementById("railCompanyName"),
  questionTitle: document.getElementById("questionTitle"),
  questionCategory: document.getElementById("questionCategory"),
  progressText: document.getElementById("progressText"),
  questionText: document.getElementById("questionText"),
  questionGuide: document.getElementById("questionGuide"),
  answerInput: document.getElementById("answerInput"),
  submitAnswerBtn: document.getElementById("submitAnswerBtn"),
  skipQuestionBtn: document.getElementById("skipQuestionBtn"),
  practiceMessage: document.getElementById("practiceMessage"),
  practiceRoleName: document.getElementById("practiceRoleName"),
  practiceCompanyName: document.getElementById("practiceCompanyName"),
  practiceProgressMetric: document.getElementById("practiceProgressMetric"),
  overallReadiness: document.getElementById("overallReadiness"),
  reportSummary: document.getElementById("reportSummary"),
  reportOverallMetric: document.getElementById("reportOverallMetric"),
  reportAnsweredMetric: document.getElementById("reportAnsweredMetric"),
  reportSkippedMetric: document.getElementById("reportSkippedMetric"),
  reportTypeMetric: document.getElementById("reportTypeMetric"),
  individualScores: document.getElementById("individualScores"),
  strongAnswers: document.getElementById("strongAnswers"),
  weakAnswers: document.getElementById("weakAnswers"),
  commonMistakes: document.getElementById("commonMistakes"),
  resumeStrengths: document.getElementById("resumeStrengths"),
  skillsToReview: document.getElementById("skillsToReview"),
  retryQuestions: document.getElementById("retryQuestions"),
  jobGaps: document.getElementById("jobGaps"),
  practicePlan: document.getElementById("practicePlan"),
  restartBtn: document.getElementById("restartBtn"),
  saveSessionBtn: document.getElementById("saveSessionBtn"),
  loadSessionBtn: document.getElementById("loadSessionBtn"),
  sessionMessage: document.getElementById("sessionMessage"),
  savedSessionsDialog: document.getElementById("savedSessionsDialog"),
  savedSessionsList: document.getElementById("savedSessionsList"),
  closeDialogBtn: document.getElementById("closeDialogBtn"),
  savedSessionsPanel: document.getElementById("savedSessionsPanel"),
  savedSessionsPanelList: document.getElementById("savedSessionsPanelList"),
  closeSavedPanelBtn: document.getElementById("closeSavedPanelBtn"),
};

function setView(viewName) {
  for (const view of [els.setupView, els.practiceView, els.reportView]) {
    view.classList.remove("active");
  }
  els[viewName].classList.add("active");
}

function setBusy(message, target = "setup") {
  if (target === "setup") {
    els.setupStatus.textContent = message;
    els.generateBtn.disabled = true;
  } else if (target === "practice") {
    els.practiceMessage.textContent = message;
    els.submitAnswerBtn.disabled = true;
    els.skipQuestionBtn.disabled = true;
  } else if (target === "report") {
    els.overallReadiness.textContent = message;
  }
}

function clearBusy(target = "setup") {
  if (target === "setup") {
    els.setupStatus.textContent = "Ready";
    els.generateBtn.disabled = false;
  } else if (target === "practice") {
    els.submitAnswerBtn.disabled = false;
    els.skipQuestionBtn.disabled = false;
  }
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,;\u2022]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function unique(items) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function renderList(element, items, fallback = "None yet.") {
  const normalized = unique(items);
  element.innerHTML = normalized.length
    ? normalized.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : `<li>${escapeHtml(fallback)}</li>`;
}

function flashButton(button, className = "button-success") {
  button.classList.remove(className);
  void button.offsetWidth;
  button.classList.add(className);
  setTimeout(() => button.classList.remove(className), 650);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function detectBehavioral(category, questionText) {
  const source = `${category} ${questionText}`.toLowerCase();
  return ["behavioral", "leadership", "teamwork", "conflict", "challenge", "time", "mistake"].some((keyword) =>
    source.includes(keyword)
  );
}

function extractKeywords(text) {
  return unique(
    (text.toLowerCase().match(/\b[a-z][a-z0-9+#.-]{2,}\b/g) || []).filter(
      (word) => !STOP_WORDS.has(word) && word.length > 2
    )
  );
}

function buildResumeAnalysis(resumeText, jobDescription) {
  const resumeLines = resumeText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const lowerText = resumeText.toLowerCase();
  const sections = {
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    achievements: [],
    leadership: [],
    technicalAbilities: [],
    softSkills: [],
    weakSpots: [],
    gaps: [],
  };

  for (const line of resumeLines) {
    const trimmed = line.replace(/^[\u2022*-]\s*/, "");
    const lower = trimmed.toLowerCase();

    if (/(bachelor|master|phd|university|college|school)/i.test(trimmed)) sections.education.push(trimmed);
    if (/(certified|certification|certificate|aws|azure|gcp)/i.test(trimmed)) sections.certifications.push(trimmed);
    if (/(project|portfolio|capstone|built|developed|created)/i.test(trimmed)) sections.projects.push(trimmed);
    if (/(lead|mentor|captain|president|chair|managed|owner)/i.test(trimmed)) sections.leadership.push(trimmed);
    if (/(award|achiev|honor|scholarship|improved|increased|reduced|saved|grew)/i.test(trimmed)) {
      sections.achievements.push(trimmed);
    }
    if (/(teamwork|communication|collaboration|organized|adaptable|leadership|problem)/i.test(trimmed)) {
      sections.softSkills.push(trimmed);
    }
    if (/(python|java|javascript|typescript|react|sql|excel|aws|docker|html|css|node|c\+\+|git|figma)/i.test(trimmed)) {
      sections.technicalAbilities.push(trimmed);
      sections.skills.push(...trimmed.match(/([A-Za-z+#.]{2,})/g) || []);
    }
    if (/\b(20\d{2}|present)\b/i.test(trimmed) || /(intern|engineer|analyst|assistant|manager|developer)/i.test(trimmed)) {
      sections.experience.push(trimmed);
    }
  }

  const jdKeywords = extractKeywords(jobDescription);
  const resumeKeywords = extractKeywords(resumeText);
  const missingKeywords = jdKeywords.filter((keyword) => !resumeKeywords.includes(keyword)).slice(0, 10);

  if (!sections.experience.length) sections.weakSpots.push("Resume does not show much clearly labeled work experience.");
  if (!sections.projects.length) sections.weakSpots.push("Project evidence looks thin for role-specific storytelling.");
  if (!sections.achievements.length) sections.weakSpots.push("Resume has limited quantified achievements for impact-based answers.");
  if (!/linkedin|portfolio|github/i.test(lowerText)) sections.weakSpots.push("No visible portfolio or public proof points were detected.");

  sections.gaps = missingKeywords.map((keyword) => `Job description references "${keyword}" but it is not obvious in the resume.`);
  sections.skills = unique([...sections.skills, ...resumeKeywords.filter((keyword) => jdKeywords.includes(keyword)).slice(0, 10)]);
  sections.technicalAbilities = unique(sections.technicalAbilities).slice(0, 8);
  sections.softSkills = unique(sections.softSkills).slice(0, 6);
  sections.experience = unique(sections.experience).slice(0, 8);
  sections.education = unique(sections.education).slice(0, 4);
  sections.projects = unique(sections.projects).slice(0, 6);
  sections.certifications = unique(sections.certifications).slice(0, 4);
  sections.achievements = unique(sections.achievements).slice(0, 6);
  sections.leadership = unique(sections.leadership).slice(0, 6);
  sections.weakSpots = unique(sections.weakSpots).slice(0, 6);

  return sections;
}

function renderResumeAnalysis(analysis) {
  return analysis;
}

function updateSetupRail() {
  const draft = collectDraftSetup();
  els.railInterviewType.textContent = draft.interviewType || "Mixed interview";
  els.railDifficulty.textContent = draft.difficulty || "Moderate";
  els.railQuestionCount.textContent = String(draft.questionCount || 8);
  els.railRoleTitle.textContent = draft.jobTitle || "Target role not set";
  els.railCompanyName.textContent = draft.companyName
    ? `${draft.companyName} interview brief`
    : "Add a company name to tailor the question set.";
}

function updatePracticeOverview(question) {
  const setup = state.setup || collectDraftSetup();
  els.practiceRoleName.textContent = setup.jobTitle || "Interview session";
  els.practiceCompanyName.textContent = setup.companyName || "Not set";
  els.practiceProgressMetric.textContent = `${state.currentQuestionIndex + 1} / ${state.questions.length}`;
  if (question) {
    els.questionCategory.textContent = question.category;
  }
}

function updateReportMetrics(report) {
  const answeredCount = state.responses.filter((item) => item.answerText && item.answerText.trim()).length;
  const skippedCount = state.responses.filter((item) => item.skipped || !item.answerText || !item.answerText.trim()).length;
  els.reportOverallMetric.textContent = `${report.overallReadinessScore}%`;
  els.reportAnsweredMetric.textContent = String(answeredCount);
  els.reportSkippedMetric.textContent = String(skippedCount);
  els.reportTypeMetric.textContent = state.setup?.interviewType || "Mixed interview";
}

async function extractResumeText(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (extension === "txt") {
    return file.text();
  }
  if (extension === "pdf") {
    const pdfjsLib = await loadPdfJs();
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pageTexts = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map((item) => item.str).join(" "));
    }
    return pageTexts.join("\n");
  }
  if (extension === "docx") {
    const mammoth = await loadMammoth();
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }
  throw new Error("Unsupported file type.");
}

function loadMammoth() {
  if (window.mammoth) {
    return Promise.resolve(window.mammoth);
  }
  if (!mammothPromise) {
    mammothPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/mammoth@1.8.0/mammoth.browser.min.js";
      script.onload = () => resolve(window.mammoth);
      script.onerror = () => reject(new Error("DOCX parser failed to load. Paste your resume text instead."));
      document.head.appendChild(script);
    });
  }
  return mammothPromise;
}

async function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("https://unpkg.com/pdfjs-dist@4.5.136/build/pdf.min.mjs").then((module) => {
      module.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs";
      return module;
    });
  }
  return pdfjsLibPromise;
}

async function callGemini({ prompt, schema }) {
  let response;
  try {
    response = await fetch(GEMINI_PROXY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.65,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    });
  } catch (error) {
    throw new Error(
      "Gemini could not be reached from this page. Use the deployed Vercel app or a Vercel-backed local server, then try again."
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini did not return any content.");
  }
  return JSON.parse(text);
}

function questionSchema() {
  return {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: { type: "string" },
            category: { type: "string" },
            difficulty: { type: "string" },
            relevance: { type: "string" },
            strongAnswerIncludes: { type: "string" },
          },
          required: ["question", "category", "difficulty", "relevance", "strongAnswerIncludes"],
        },
      },
    },
    required: ["questions"],
  };
}

function feedbackSchema() {
  return {
    type: "object",
    properties: {
      score: { type: "integer" },
      scoreReason: { type: "string" },
      wentWell: { type: "array", items: { type: "string" } },
      needsImprovement: { type: "array", items: { type: "string" } },
      starAnalysis: {
        type: "object",
        properties: {
          situation: { type: "string" },
          task: { type: "string" },
          action: { type: "string" },
          result: { type: "string" },
        },
        required: ["situation", "task", "action", "result"],
      },
      improvedAnswer: { type: "string" },
      finalTip: { type: "string" },
    },
    required: ["score", "scoreReason", "wentWell", "needsImprovement", "starAnalysis", "improvedAnswer", "finalTip"],
  };
}

function reportSchema() {
  return {
    type: "object",
    properties: {
      overallReadinessScore: { type: "integer" },
      summary: { type: "string" },
      strongestAnswers: { type: "array", items: { type: "string" } },
      weakestAnswers: { type: "array", items: { type: "string" } },
      commonMistakes: { type: "array", items: { type: "string" } },
      resumeStrengths: { type: "array", items: { type: "string" } },
      skillsToReview: { type: "array", items: { type: "string" } },
      questionsToPracticeAgain: { type: "array", items: { type: "string" } },
      gapsVsJobDescription: { type: "array", items: { type: "string" } },
      practicePlan: { type: "array", items: { type: "string" } },
    },
    required: [
      "overallReadinessScore",
      "summary",
      "strongestAnswers",
      "weakestAnswers",
      "commonMistakes",
      "resumeStrengths",
      "skillsToReview",
      "questionsToPracticeAgain",
      "gapsVsJobDescription",
      "practicePlan",
    ],
  };
}

function buildQuestionPrompt(setup, analysis) {
  return `
You are InterviewPrep AI, a realistic interview coach.

Create ${setup.questionCount} personalized interview questions for this specific candidate and role.
The questions must feel realistic, not generic. Use the resume, job description, company, job title, likely expectations, strengths, and weak spots.

Honesty rules:
- Do not invent experience, projects, skills, or education.
- If the resume seems thin in an area, ask about that gap honestly.
- Include behavioral, resume-based, role-specific, company-specific, strengths/weaknesses, problem-solving, and gap-based questions where relevant.

Candidate resume:
${setup.resumeText}

Resume analysis:
${JSON.stringify(analysis, null, 2)}

Job description:
${setup.jobDescription}

Company:
${setup.companyName}

Job title:
${setup.jobTitle}

Interview type:
${setup.interviewType}

Difficulty:
${setup.difficulty}

Return a JSON object with a "questions" array. Each item must include:
- question
- category
- difficulty
- relevance
- strongAnswerIncludes
  `.trim();
}

function buildFeedbackPrompt(setup, analysis, question, answerText) {
  return `
You are InterviewPrep AI, an honest but encouraging mock interview coach.

Review the user's answer for the interview question below.
Use only facts that appear in the resume or the answer. Do not invent experience, projects, skills, education, or outcomes.
Give specific coaching tied to the job description and the candidate's evidence.

Resume:
${setup.resumeText}

Resume analysis:
${JSON.stringify(analysis, null, 2)}

Job description:
${setup.jobDescription}

Company:
${setup.companyName}

Job title:
${setup.jobTitle}

Interview type:
${setup.interviewType}

Question category:
${question.category}

Question:
${question.question}

User answer:
${answerText}

Scoring rules:
- score must be from 0 to 100
- praise should be earned and concrete
- improvement notes must explain what is missing or weak
- always return starAnalysis with situation, task, action, and result
- for non-behavioral questions, set each STAR field to "Not applicable"
- for behavioral questions, mark each STAR field as present, missing, or weak with a short explanation
- improvedAnswer must stay honest and only sharpen structure, clarity, and relevance
- do not add bracket placeholders or invented specifics in improvedAnswer
- if the answer lacks evidence, say what evidence is missing instead of filling it in
  `.trim();
}

function buildReportPrompt(setup, analysis, questions, responses) {
  return `
You are InterviewPrep AI preparing a final interview readiness report.

Use the full practice session to create a realistic and practical summary.
Be honest, supportive, and specific. Do not invent any candidate experience.

Resume analysis:
${JSON.stringify(analysis, null, 2)}

Role setup:
${JSON.stringify(
    {
      companyName: setup.companyName,
      jobTitle: setup.jobTitle,
      interviewType: setup.interviewType,
      difficulty: setup.difficulty,
    },
    null,
    2
  )}

Job description:
${setup.jobDescription}

Questions:
${JSON.stringify(questions, null, 2)}

Responses and feedback:
${JSON.stringify(responses, null, 2)}
  `.trim();
}

function normalizeQuestions(rawQuestions) {
  return (rawQuestions.questions || []).map((item, index) => ({
    id: `q-${index + 1}`,
    question: item.question?.trim() || `Question ${index + 1}`,
    category: item.category?.trim() || "General",
    difficulty: item.difficulty?.trim() || "Moderate",
    relevance: item.relevance?.trim() || "Relevant to the target role.",
    strongAnswerIncludes: item.strongAnswerIncludes?.trim() || "Clear structure, role fit, and evidence.",
  }));
}

function normalizeFeedback(questionId, answerText, rawFeedback, isBehavioral) {
  const rawScore = Number(rawFeedback.score) || 0;
  const scorePercent = Math.max(0, Math.min(100, rawScore <= 10 ? rawScore * 10 : rawScore));
  const starAnalysis =
    isBehavioral && rawFeedback.starAnalysis
      ? {
          situation: rawFeedback.starAnalysis.situation || "Missing",
          task: rawFeedback.starAnalysis.task || "Missing",
          action: rawFeedback.starAnalysis.action || "Missing",
          result: rawFeedback.starAnalysis.result || "Missing",
        }
      : null;

  return {
    questionId,
    answerText,
    scorePercent,
    scoreOutOf10: (scorePercent / 10).toFixed(1),
    scoreReason: rawFeedback.scoreReason?.trim() || "No score explanation returned.",
    wentWell: normalizeList(rawFeedback.wentWell),
    needsImprovement: normalizeList(rawFeedback.needsImprovement),
    starAnalysis,
    improvedAnswer: rawFeedback.improvedAnswer?.trim() || answerText,
    finalTip: rawFeedback.finalTip?.trim() || "Practice saying the answer out loud once more.",
  };
}

function localFallbackReport() {
  const scored = state.responses.filter((item) => typeof item.scorePercent === "number");
  const average = scored.length
    ? Math.round(scored.reduce((sum, item) => sum + item.scorePercent, 0) / scored.length)
    : 0;
  const strongest = [...scored].sort((a, b) => b.scorePercent - a.scorePercent).slice(0, 3);
  const weakest = [...scored].sort((a, b) => a.scorePercent - b.scorePercent).slice(0, 3);

  return {
    overallReadinessScore: average,
    summary:
      average >= 75
        ? "You have a solid base for this interview. Tighten your weakest examples and rehearse delivery."
        : "You have useful raw material, but several answers need stronger evidence, structure, and role alignment.",
    strongestAnswers: strongest.map((item) => questionById(item.questionId)?.question || "Strong response"),
    weakestAnswers: weakest.map((item) => questionById(item.questionId)?.question || "Weak response"),
    commonMistakes: unique(scored.flatMap((item) => item.needsImprovement)).slice(0, 6),
    resumeStrengths: unique([
      ...state.resumeAnalysis.skills,
      ...state.resumeAnalysis.achievements,
      ...state.resumeAnalysis.projects,
    ]).slice(0, 6),
    skillsToReview: extractKeywords(state.setup.jobDescription)
      .filter((keyword) => !extractKeywords(state.setup.resumeText).includes(keyword))
      .slice(0, 6),
    questionsToPracticeAgain: weakest.map((item) => questionById(item.questionId)?.question || "Review this question"),
    gapsVsJobDescription: state.resumeAnalysis.gaps.slice(0, 6),
    practicePlan: unique([
      "Rewrite your lowest-scoring answers using tighter examples and clearer structure.",
      "Prepare one quantified example for each major requirement in the job description.",
      "Practice saying why this company and why this role in under 60 seconds.",
      "Turn vague claims into specific actions, tools, and outcomes.",
    ]).slice(0, 6),
  };
}

async function gradeAllResponses() {
  for (let index = 0; index < state.questions.length; index += 1) {
    const question = state.questions[index];
    let response = state.responses.find((item) => item.questionId === question.id);

    if (!response) {
      response = {
        questionId: question.id,
        answerText: "",
        skipped: true,
      };
      state.responses.push(response);
    }

    if (typeof response.scorePercent === "number") continue;

    if (response.skipped || !response.answerText.trim()) {
      Object.assign(response, {
        scorePercent: 0,
        scoreOutOf10: "0.0",
        scoreReason: "Question skipped or left unanswered.",
        wentWell: [],
        needsImprovement: ["Practice and answer this question before the interview."],
        starAnalysis: null,
        improvedAnswer: "No answer submitted.",
        finalTip: "Prepare a direct, honest answer for this question.",
      });
      continue;
    }

    els.practiceMessage.textContent = `Grading answer ${index + 1} of ${state.questions.length}...`;
    try {
      const isBehavioral = detectBehavioral(question.category, question.question);
      const rawFeedback = await callGemini({
        prompt: buildFeedbackPrompt(state.setup, state.resumeAnalysis, question, response.answerText),
        schema: feedbackSchema(),
      });
      Object.assign(response, normalizeFeedback(question.id, response.answerText, rawFeedback, isBehavioral));
    } catch (error) {
      Object.assign(response, {
        scorePercent: 50,
        scoreOutOf10: "5.0",
        scoreReason: `Gemini could not grade this answer: ${error.message}`,
        wentWell: ["Answer was submitted."],
        needsImprovement: ["Try grading this session again when Gemini is reachable."],
        starAnalysis: null,
        improvedAnswer: response.answerText,
        finalTip: "Review this answer manually and add more specific evidence.",
      });
    }
  }
}

function questionById(questionId) {
  return state.questions.find((item) => item.id === questionId);
}

function renderQuestion() {
  const question = state.questions[state.currentQuestionIndex];
  if (!question) return;

  els.questionTitle.textContent = `Question ${state.currentQuestionIndex + 1}`;
  els.progressText.textContent = `${state.currentQuestionIndex + 1} / ${state.questions.length}`;
  els.questionText.textContent = question.question;
  els.questionGuide.textContent = question.strongAnswerIncludes;
  updatePracticeOverview(question);

  const existingResponse = state.responses.find((item) => item.questionId === question.id);
  els.answerInput.value = existingResponse?.answerText || "";
  const isLastQuestion = state.currentQuestionIndex >= state.questions.length - 1;
  els.submitAnswerBtn.textContent = isLastQuestion ? "Submit Final Answer & Grade" : "Save Answer & Continue";
  els.practiceMessage.textContent = existingResponse ? "Saved answer loaded. You can edit it before continuing." : "";
}

function renderReport(report) {
  els.overallReadiness.textContent = `Overall readiness ${report.overallReadinessScore}%`;
  els.reportSummary.textContent = report.summary;
  updateReportMetrics(report);
  renderIndividualScores();
  renderList(els.strongAnswers, report.strongestAnswers, "No answers scored yet.");
  renderList(els.weakAnswers, report.weakestAnswers, "No weak answers flagged.");
  renderList(els.commonMistakes, report.commonMistakes, "No repeated mistakes detected.");
  renderList(els.resumeStrengths, report.resumeStrengths, "No strengths captured.");
  renderList(els.skillsToReview, report.skillsToReview, "No extra review items flagged.");
  renderList(els.retryQuestions, report.questionsToPracticeAgain, "No retry list yet.");
  renderList(els.jobGaps, report.gapsVsJobDescription, "No major gaps detected.");
  renderList(els.practicePlan, report.practicePlan, "No practice plan generated.");
}

function renderIndividualScores() {
  const items = state.questions.map((question, index) => {
    const response = state.responses.find((item) => item.questionId === question.id);
    const score = response?.scoreOutOf10 || "0.0";
    const reason = response?.scoreReason || "No grading note available.";
    return `Question ${index + 1}: ${score} / 10 - ${question.question} - ${reason}`;
  });
  renderList(els.individualScores, items, "No question scores available.");
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function collectSetup() {
  const resumeText = els.resumeText.value.trim() || state.resumeText.trim();
  const setup = {
    resumeText,
    jobDescription: els.jobDescription.value.trim(),
    companyName: els.companyName.value.trim(),
    jobTitle: els.jobTitle.value.trim(),
    interviewType: els.interviewType.value,
    difficulty: els.difficulty.value,
    questionCount: Math.max(3, Math.min(15, Number(els.questionCount.value) || 8)),
  };

  if (!setup.resumeText || !setup.jobDescription || !setup.companyName || !setup.jobTitle) {
    throw new Error("Please provide your resume, job description, company name, and job title.");
  }
  return setup;
}

function collectDraftSetup() {
  const resumeText = els.resumeText.value.trim() || state.resumeText.trim();
  return {
    resumeText,
    jobDescription: els.jobDescription.value.trim(),
    companyName: els.companyName.value.trim(),
    jobTitle: els.jobTitle.value.trim(),
    interviewType: els.interviewType.value,
    difficulty: els.difficulty.value,
    questionCount: Math.max(3, Math.min(15, Number(els.questionCount.value) || 8)),
  };
}

function getSavedSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistSessionSnapshot(name = null) {
  const sessions = getSavedSessions();
  const sessionId = crypto.randomUUID();
  const setup = state.setup || collectDraftSetup();
  if (!setup.resumeText && !setup.jobDescription && !setup.companyName && !setup.jobTitle) {
    throw new Error("Add some interview details before saving.");
  }
  const session = {
    sessionId,
    createdAt: new Date().toISOString(),
    name: name || `${setup.jobTitle || "Draft interview"} @ ${setup.companyName || "Unknown company"}`,
    setup,
    resumeAnalysis: state.resumeAnalysis,
    questions: state.questions,
    responses: state.responses,
    report: state.finalReport,
  };
  sessions.unshift(session);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 12)));
  return session;
}

function renderSavedSessions(target = els.savedSessionsList) {
  const sessions = getSavedSessions();
  if (!sessions.length) {
    target.innerHTML = '<div class="empty-state">No saved sessions on this device yet.</div>';
    return;
  }

  target.innerHTML = sessions
    .map(
      (session) => `
        <article class="saved-item" data-session-id="${escapeHtml(session.sessionId)}">
          <div class="saved-item-header">
            <div>
              <h3>${escapeHtml(session.name || "Saved session")}</h3>
              <p class="helper-text">${escapeHtml(new Date(session.createdAt).toLocaleString())}</p>
            </div>
            <span class="status-pill">${escapeHtml(session.setup.jobTitle)}</span>
          </div>
          <p class="helper-text">${escapeHtml(session.setup.companyName)}</p>
          <div class="saved-item-actions">
            <button class="secondary-btn" type="button" data-action="load">Load</button>
            <button class="ghost-btn" type="button" data-action="delete">Delete</button>
          </div>
        </article>
      `
    )
    .join("");
}

function hydrateSession(session) {
  state.resumeText = session.setup.resumeText;
  state.resumeAnalysis = session.resumeAnalysis;
  state.setup = session.setup;
  state.questions = session.questions || [];
  state.responses = session.responses || [];
  state.currentQuestionIndex = 0;
  state.finalReport = session.report || null;

  els.resumeText.value = session.setup.resumeText || "";
  els.jobDescription.value = session.setup.jobDescription || "";
  els.companyName.value = session.setup.companyName || "";
  els.jobTitle.value = session.setup.jobTitle || "";
  els.interviewType.value = session.setup.interviewType || "Mixed interview";
  els.difficulty.value = session.setup.difficulty || "Moderate";
  els.questionCount.value = session.setup.questionCount || 8;

  renderResumeAnalysis(state.resumeAnalysis);
  updateSetupRail();

  if (state.finalReport) {
    renderReport(state.finalReport);
    setView("reportView");
  } else if (state.questions.length) {
    renderQuestion();
    setView("practiceView");
  } else {
    setView("setupView");
  }
}

async function handleGenerateQuestions() {
  try {
    const setup = collectSetup();
    state.setup = setup;
    state.resumeText = setup.resumeText;
    state.resumeAnalysis = buildResumeAnalysis(setup.resumeText, setup.jobDescription);
    renderResumeAnalysis(state.resumeAnalysis);

    setBusy("Generating...");
    els.generationMessage.textContent = "Creating personalized questions...";

    const rawQuestions = await callGemini({
      prompt: buildQuestionPrompt(setup, state.resumeAnalysis),
      schema: questionSchema(),
    });

    const questions = normalizeQuestions(rawQuestions);
    if (!questions.length) {
      throw new Error("No questions were returned. Please try again.");
    }

    state.questions = questions;
    state.responses = [];
    state.currentQuestionIndex = 0;
    state.currentFeedbackIndex = null;
    state.finalReport = null;

    renderQuestion();
    setView("practiceView");
    els.generationMessage.textContent = `${questions.length} personalized questions ready.`;
  } catch (error) {
    els.generationMessage.textContent = error.message;
    alert(error.message);
  } finally {
    clearBusy();
  }
}

async function handleSubmitAnswer() {
  const question = state.questions[state.currentQuestionIndex];
  const answerText = els.answerInput.value.trim();
  if (!question || !answerText) {
    alert("Please write an answer before submitting.");
    return;
  }

  saveCurrentAnswer(answerText);
  goToNextQuestion();
}

function saveCurrentAnswer(answerText, skipped = false) {
  const question = state.questions[state.currentQuestionIndex];
  if (!question) return;

  const existingIndex = state.responses.findIndex((item) => item.questionId === question.id);
  const existing = existingIndex >= 0 ? state.responses[existingIndex] : {};
  const response = {
    ...existing,
    questionId: question.id,
    answerText,
    skipped,
  };

  if (existingIndex >= 0) {
    state.responses[existingIndex] = response;
  } else {
    state.responses.push(response);
  }
}

function handleSkipQuestion() {
  const question = state.questions[state.currentQuestionIndex];
  if (!question) return;
  saveCurrentAnswer("", true);
  goToNextQuestion();
}

function goToNextQuestion() {
  if (state.currentQuestionIndex < state.questions.length - 1) {
    state.currentQuestionIndex += 1;
    renderQuestion();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  handleFinalReport();
}

async function handleFinalReport() {
  try {
    setBusy("Grading all answers...", "practice");
    await gradeAllResponses();
    setBusy("Generating report...", "report");
    let report;

    try {
      report = await callGemini({
        prompt: buildReportPrompt(state.setup, state.resumeAnalysis, state.questions, state.responses),
        schema: reportSchema(),
      });
    } catch {
      report = localFallbackReport();
    }

    state.finalReport = report;
    renderReport(report);
    setView("reportView");
  } catch (error) {
    alert(error.message);
  } finally {
    clearBusy("practice");
  }
}

function resetApp() {
  state.resumeText = "";
  state.resumeAnalysis = null;
  state.setup = null;
  state.questions = [];
  state.responses = [];
  state.currentQuestionIndex = 0;
  state.currentFeedbackIndex = null;
  state.finalReport = null;

  els.resumeFile.value = "";
  els.fileMeta.textContent = "Accepted types: PDF, DOCX, TXT";
  els.resumeText.value = "";
  els.jobDescription.value = "";
  els.companyName.value = "";
  els.jobTitle.value = "";
  els.interviewType.value = "Mixed interview";
  els.difficulty.value = "Moderate";
  els.questionCount.value = 8;
  els.generationMessage.textContent = "";
  renderResumeAnalysis(null);
  updateSetupRail();
  setView("setupView");
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "along",
  "also",
  "been",
  "being",
  "both",
  "each",
  "from",
  "have",
  "into",
  "job",
  "more",
  "must",
  "role",
  "team",
  "with",
  "that",
  "this",
  "their",
  "they",
  "your",
  "ours",
  "them",
  "will",
  "would",
  "should",
  "using",
  "years",
  "year",
  "work",
  "experience",
  "responsible",
  "required",
  "preferred",
  "skills",
]);

els.resumeFile.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    els.fileMeta.textContent = `Reading ${file.name}...`;
    const text = await extractResumeText(file);
    state.resumeText = text.trim();
    els.resumeText.value = state.resumeText;
    els.fileMeta.textContent = `${file.name} loaded. ${state.resumeText.length.toLocaleString()} characters extracted.`;

    if (els.jobDescription.value.trim()) {
      state.resumeAnalysis = buildResumeAnalysis(state.resumeText, els.jobDescription.value.trim());
      renderResumeAnalysis(state.resumeAnalysis);
    }
  } catch (error) {
    els.fileMeta.textContent = error.message;
  }
});

els.resumeText.addEventListener("input", () => {
  state.resumeText = els.resumeText.value;
  updateSetupRail();
});

els.jobDescription.addEventListener("input", () => {
  const resumeText = els.resumeText.value.trim() || state.resumeText.trim();
  if (resumeText && els.jobDescription.value.trim()) {
    state.resumeAnalysis = buildResumeAnalysis(resumeText, els.jobDescription.value.trim());
    renderResumeAnalysis(state.resumeAnalysis);
  }
  updateSetupRail();
});

els.companyName.addEventListener("input", updateSetupRail);
els.jobTitle.addEventListener("input", updateSetupRail);
els.interviewType.addEventListener("change", updateSetupRail);
els.difficulty.addEventListener("change", updateSetupRail);
els.questionCount.addEventListener("input", updateSetupRail);

els.generateBtn.addEventListener("click", handleGenerateQuestions);
els.submitAnswerBtn.addEventListener("click", handleSubmitAnswer);
els.skipQuestionBtn.addEventListener("click", handleSkipQuestion);
els.restartBtn.addEventListener("click", resetApp);

els.saveSessionBtn.addEventListener("click", () => {
  flashButton(els.saveSessionBtn, "button-pressed");
  try {
    const saved = persistSessionSnapshot();
    els.sessionMessage.textContent = `Saved: ${saved.name}`;
    flashButton(els.saveSessionBtn);
  } catch (error) {
    els.sessionMessage.textContent = error.message;
    alert(error.message);
  }
});

els.loadSessionBtn.addEventListener("click", () => {
  flashButton(els.loadSessionBtn, "button-pressed");
  els.sessionMessage.textContent = "";
  if (typeof els.savedSessionsDialog.showModal === "function") {
    renderSavedSessions(els.savedSessionsList);
    els.savedSessionsDialog.showModal();
  } else {
    renderSavedSessions(els.savedSessionsPanelList);
    els.savedSessionsPanel.classList.remove("hidden");
  }
});

els.closeDialogBtn.addEventListener("click", () => {
  els.savedSessionsDialog.close();
});

els.closeSavedPanelBtn.addEventListener("click", () => {
  els.savedSessionsPanel.classList.add("hidden");
});

function handleSavedSessionAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const item = event.target.closest("[data-session-id]");
  const sessionId = item?.dataset.sessionId;
  if (!sessionId) return;

  const sessions = getSavedSessions();
  if (button.dataset.action === "delete") {
    const filtered = sessions.filter((session) => session.sessionId !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    renderSavedSessions(els.savedSessionsDialog.open ? els.savedSessionsList : els.savedSessionsPanelList);
    return;
  }

  const session = sessions.find((entry) => entry.sessionId === sessionId);
  if (session) {
    hydrateSession(session);
    if (els.savedSessionsDialog.open) els.savedSessionsDialog.close();
    els.savedSessionsPanel.classList.add("hidden");
    els.sessionMessage.textContent = `Loaded: ${session.name || "Saved session"}`;
    flashButton(els.loadSessionBtn);
  }
}

els.savedSessionsList.addEventListener("click", handleSavedSessionAction);
els.savedSessionsPanelList.addEventListener("click", handleSavedSessionAction);

renderResumeAnalysis(null);
updateSetupRail();
