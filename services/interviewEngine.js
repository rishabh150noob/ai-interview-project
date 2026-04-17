
const AI_MODEL = process.env.AI_MODEL || "llama-3.1-8b-instant";
const openai = require("./openai");

async function extractResumeData(resumeText) {
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.3,
    messages: [
      {
        role: "user",
        content: `
You are an expert resume parser.
Extract structured candidate information from the resume below.
Return ONLY valid JSON with this exact structure:

{
  "name": "",
  "technical_skills": [],
  "projects": [],
  "achievements": [],
  "certifications": [],
  "work_experience_summary": [],
  "education_summary": []
}

Rules:
- If something is missing, return empty string or empty list.
- Return only raw JSON. No markdown, no explanation.

Resume:
${resumeText}
        `.trim(),
      },
    ],
  });

  const raw = response.choices[0].message.content.trim();
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  }
}


function initializeInterviewState() {
  return {
    question_count: 0,
    topics_covered: {
      projects: false,
      skills: false,
      experience: false,
      achievements: false,
      behavioral: false,
    },
    weak_areas: [],
    strong_areas: [],
    interview_stage: "start",
    ended: false,
  };
}


async function generateNextQuestion(candidateState, interviewState, record) {
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.7,
    messages: [
      {
        role: "user",
        content: `
You are an AI interviewer conducting a job interview.

Candidate Profile:
${JSON.stringify(candidateState, null, 2)}

Current Interview State:
${JSON.stringify(interviewState, null, 2)}

Interview Transcript So Far:
${record || "None yet."}

Your task:
- Decide whether to go deeper on the current topic or move to the next uncovered topic.
- Avoid repeating already asked questions.
- Ask exactly ONE interview question.

Output only the question text. Nothing else.
        `.trim(),
      },
    ],
  });

  return response.choices[0].message.content.trim();
}


async function updateInterviewState(interviewState, question, answer) {
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "user",
        content: `
You are an interview state tracker.

Update the interview state based on:
1. The interviewer's question
2. The candidate's answer
3. The current state

Return ONLY valid raw JSON — no markdown, no explanation.

Current State:
${JSON.stringify(interviewState, null, 2)}

Interviewer Question:
${question}

Candidate Answer:
${answer}

Update these fields carefully:
- question_count: increment by 1
- topics_covered.projects
- topics_covered.skills
- topics_covered.experience
- topics_covered.achievements
- topics_covered.behavioral
- weak_areas (add if answer was vague, shallow, or incorrect)
- strong_areas (add if answer showed depth, clarity, or ownership)
- interview_stage: one of "start" | "mid" | "deep_dive" | "closing"

Rules:
- Mark a topic covered only if it was genuinely discussed in this Q&A.
- Return ONLY JSON.
        `.trim(),
      },
    ],
  });

  const raw = response.choices[0].message.content.trim();
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  }
}


function shouldEndInterview(interviewState) {
  const t = interviewState.topics_covered;

  const enoughTopics =
    t.projects &&
    t.skills &&
    (t.experience || t.achievements) &&
    t.behavioral;

  const enoughQuestions = interviewState.question_count >= 8;

  interviewState.ended = enoughTopics && enoughQuestions;
  return interviewState;
}


async function generateFinalFeedback(candidateState, interviewState, record) {
  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.5,
    messages: [
      {
        role: "user",
        content: `
You are an expert interview evaluator.

Based on the candidate profile, interview state, and transcript below,
generate a final interview evaluation report.

Candidate Profile:
${JSON.stringify(candidateState, null, 2)}

Interview State:
${JSON.stringify(interviewState, null, 2)}

Interview Transcript:
${record}

Give output in this exact format:

1. Overall Performance
2. Strengths
3. Weaknesses
4. Technical Readiness
5. Communication Assessment
6. Suggested Areas of Improvement
7. Final Verdict (Selected / Borderline / Needs Improvement)

Be realistic and constructive.
        `.trim(),
      },
    ],
  });

  return response.choices[0].message.content;
}

module.exports = {
    // first 3 used for /start route in interview.js
  extractResumeData,
  initializeInterviewState,
  generateNextQuestion,

  updateInterviewState,
  shouldEndInterview,
  generateFinalFeedback,
};