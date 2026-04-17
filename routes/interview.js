
// 3 endpoints: /start  /answer  /feedback
 
const { Router } = require("express");
const Entry      = require("../models/entry");
 
const {
  extractResumeData,
  initializeInterviewState,
  generateNextQuestion,
  updateInterviewState,
  shouldEndInterview,
  generateFinalFeedback,
} = require("../services/interviewEngine");
 
const router = Router();
 
 

router.post("/start", async (req, res) => {
  try {
    const { entry_id } = req.body;
 
    const entry = await Entry.findById(entry_id);
    if (!entry) return res.status(404).json({ error: "Entry not found" });
 
    // Read resume text directly from DB — no Cloudinary download needed
    const resumeText = entry.resume_text;
 
    const resumeDict = await extractResumeData(resumeText);
 
    const resumeKeys = [
      "name", "technical_skills", "projects", "achievements",
      "certifications", "work_experience_summary", "education_summary",
    ];
    const candidateState = {};
    resumeKeys.forEach((k) => { candidateState[k] = resumeDict[k] ?? []; });
 
    candidateState.yoe            = entry.yoe;
    candidateState.target_role    = entry.target_role;
    candidateState.target_company = entry.target_company;
 
    const interviewState = initializeInterviewState();
    const record         = "";
 
    const firstQuestion = await generateNextQuestion(candidateState, interviewState, record);
 
    return res.json({
      question: firstQuestion,
      state: {
        candidate_state: candidateState,
        interview_state: interviewState,
        record:          record,
        next_question:   firstQuestion,
        next_answer:     "",
      },
    });
 
  } catch (err) {
    console.error("/start error:", err);
    return res.status(500).json({ error: err.message });
  }
});
 
 

router.post("/answer", async (req, res) => {
  try {
    let { state, answer } = req.body;
    answer = (answer || "").trim();

    if (!answer) {
      return res.status(400).json({ error: "Empty answer received" });
    }

    let { candidate_state, interview_state, record, next_question } = state;

    record += `\nInterviewer: ${next_question}\nCandidate: ${answer}\n`;

    interview_state = await updateInterviewState(interview_state, next_question, answer);
    if (!interview_state || typeof interview_state !== "object") 
      {
          return res.status(500).json({ error: "State update failed — bad LLM response" });
      }


    interview_state = shouldEndInterview(interview_state);

    if (interview_state.ended) {
      return res.json({
        ended: true,
        question: null,
        state: {  candidate_state, 
                  interview_state,
                  record,
                  next_question,
                  next_answer: answer 
                },
      });
    }

    const nextQuestion = await generateNextQuestion(candidate_state, interview_state, record);

    return res.json({
      ended: false,
      question: nextQuestion,
      state: {
        candidate_state,
        interview_state,
        record,
        next_question: nextQuestion,
        next_answer: "",
      },
    });

  } catch (err) {
    console.error("/answer error:", err);
    return res.status(500).json({ error: err.message });
  }
});
 
 

router.post("/feedback", async (req, res) => {
  try {
    const { state } = req.body;
    const { candidate_state, interview_state, record } = state;
 
    const feedback = await generateFinalFeedback(candidate_state, interview_state, record);
 
    return res.json({ feedback });
 
  } catch (err) {
    console.error("/feedback error:", err);
    return res.status(500).json({ error: err.message });
  }
});
 
 
module.exports = router;