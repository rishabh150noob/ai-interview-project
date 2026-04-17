
const API_BASE = "";
const entryId = new URLSearchParams(window.location.search).get("id");

const VAPI_PUBLIC_KEY = "beaf3b7d-d735-421c-836c-3476d75daf27";
const VAPI_ASSISTANT_ID = "1421d232-2710-416d-8b9d-0a1ed6b90e6f";

let interviewState = null;
let candidateMeta = null;

let vapi = null;
let isCallActive = false;
let isProcessingAnswer = false;

let feedbackRequested = false;
let feedbackGenerated = false;

let interviewStarted = false;
let closingInterview = false;
let closingMessageStarted = false;
let latestTranscript = "";
let submitTimer = null;
let localQuestionCount = 1;


window.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch(`/entry/details?id=${entryId}`);
    const data = await res.json();
    candidateMeta = data;
  } catch (err) {
    console.error("Failed to load entry details:", err);
  }

  document.getElementById("question-text").textContent =
    "Click 'Start Interview' and answer the call to begin.";
  document.getElementById("btn-start-call").disabled = false;
});


async function startVapiInterview() {
  document.getElementById("btn-start-call").disabled = true;
  setStatus("Connecting…", "active");
  showSpinner(true);

  try {
    vapi = window.vapiSDK.run({
      apiKey: VAPI_PUBLIC_KEY,
      assistant: VAPI_ASSISTANT_ID,
      config: { hideButton: false },
      assistantOverrides: {
        transcriber: {
          provider: "deepgram",
          endpointing: 300,
        },
        stopSpeakingPlan: {
          numWords: 3,
          voiceSeconds: 0.3,
          backoffSeconds: 2,
        },
      },
    });

    attachVapiListeners();
  } catch (err) {
    setStatus("Failed to connect: " + err.message, "");
    showSpinner(false);
    document.getElementById("btn-start-call").disabled = false;
  }
}


function attachVapiListeners() {
  vapi.on("call-start", () => {
    isCallActive = true;
    showSpinner(false);
    document.getElementById("btn-end-call").disabled = false;
    setStatus("Interview live — answer the greeting", "active");

    vapi.send({
      type: "add-message",
      message: {
        role: "system",
        content: `
You are a professional interviewer from ${candidateMeta?.target_company || "the company"}.
Greet the candidate warmly and naturally. Say something like:
"Hello! I'm Alex calling from ${candidateMeta?.target_company || "the company"}.
We're excited to interview you for the ${candidateMeta?.target_role || "the role"} position today.
Before we begin, are you ready to get started?"

Then wait for their response. Do not ask any technical questions yet.
        `.trim(),
      },
    });
  });

  vapi.on("call-end", async () => {
    isCallActive = false;
    document.getElementById("btn-start-call").disabled = false;
    document.getElementById("btn-end-call").disabled = true;
    setStatus("Interview ended", "");

    if (interviewState && !feedbackGenerated && !feedbackRequested) {
      await fetchFeedback();
    }
  });

  vapi.on("speech-start", () => {
    document.getElementById("wave")?.classList.add("speaking");
    setStatus("Interviewer is speaking…", "active");

    if (closingInterview) {
      closingMessageStarted = true; 
      }
  });

  vapi.on("speech-end", () => {
    document.getElementById("wave")?.classList.remove("speaking");
    
      if (closingInterview  && closingMessageStarted) {

        closingInterview = false;
        closingMessageStarted = false;
        setTimeout(() => {
          if (vapi && isCallActive) vapi.stop(); 
          fetchFeedback(); 
        }, 500);

        return;
      }

  setStatus("Your turn — speak now", "");

  });

  vapi.on("message", async (message) => {
    if (message.type === "transcript" && message.role === "user") {
      const text = message.transcript?.trim();
      if (!text) return;

      latestTranscript = text;
      document.getElementById("transcript-text").textContent = text;
      document.getElementById("transcript-text").classList.add("active");

      
      if (!interviewStarted && isReadySignal(text)) {
        interviewStarted = true;
        clearTimeout(submitTimer);
        await beginBackendInterview();
        return;
      }

      // After interview starts, submit only on final transcript.
      if (interviewStarted && interviewState && !isProcessingAnswer) {
        if (message.transcriptType === "final") {
          clearTimeout(submitTimer);
          submitTimer = setTimeout(async () => {
            await submitAnswerToBackend(latestTranscript);
          }, 1200);
        }
      }
    }

    if (message.type === "transcript" && message.role === "assistant") {
      const text = message.transcript?.trim();
      if (text && !interviewStarted) {
        document.getElementById("question-text").textContent = text;
      }
    }
  });

  vapi.on("error", (e) => {
    console.error("Vapi error:", e);
    setStatus("Vapi error", "");
  });
}


function isReadySignal(text) {
  const lower = text.toLowerCase();
  return (
    lower.includes("yes") ||
    lower.includes("yeah") ||
    lower.includes("yup") ||
    lower.includes("ready") ||
    lower.includes("sure") ||
    lower.includes("let's go") ||
    lower.includes("lets go") ||
    lower.includes("okay") ||
    lower.includes("ok") ||
    lower.includes("go ahead") ||
    lower.includes("start") ||
    lower.includes("begin")
  );
}


async function beginBackendInterview() {
  setStatus("Loading your first question…", "active");
  showSpinner(true);

  try {
    const res = await fetch(`${API_BASE}/interview/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entry_id: entryId }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || "Failed to start interview");
    }

    interviewState = data.state;
    localQuestionCount = 1;
    document.getElementById("q-counter").textContent = localQuestionCount;

    displayQuestion(data.question);
    document.getElementById("transcript-text").textContent =
      "Speak your answer naturally…";
    document.getElementById("transcript-text").classList.remove("active");

    await askVapiToSpeakQuestion(data.question);
  } catch (err) {
    setStatus("Failed to load question: " + err.message, "");
  } finally {
    showSpinner(false);
  }
}

async function askVapiToSpeakQuestion(question) {
  if (!vapi || !isCallActive) return;

  vapi.send({
    type: "add-message",
    message: {
      role: "system",
      content: `
You are a professional interviewer.
Ask ONLY this exact question naturally, then wait for the candidate to answer:

${question}
      `.trim(),
    },
  });
}


async function submitAnswerToBackend(answer) {
  if (!answer?.trim() || isProcessingAnswer) return;

  isProcessingAnswer = true;
  showSpinner(true);
  setStatus("Evaluating your answer…", "active");

  try {
    const res = await fetch(`${API_BASE}/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: interviewState,
        answer: answer.trim(),
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || "Answer submission failed");
    }

    interviewState = data.state;

    if (data.ended) {
      setStatus("Interview complete", "active");
      closingInterview = true;
      await fetchFeedback();
      endVapiInterview();
      return;
    }

    localQuestionCount += 1;
    document.getElementById("q-counter").textContent = localQuestionCount;

    document.getElementById("transcript-text").textContent =
      "Speak your answer naturally…";
    document.getElementById("transcript-text").classList.remove("active");

    displayQuestion(data.question);
    await askVapiToSpeakQuestion(data.question);
  } catch (err) {
    console.error("submitAnswerToBackend error:", err);
    setStatus("Error: " + err.message, "");
  } finally {
    isProcessingAnswer = false;
    showSpinner(false);
  }
}

function endVapiInterview() {
  if (!vapi || !isCallActive) return;
  if (closingInterview) return;

  closingInterview = true;
  closingMessageStarted = false;
  vapi.send({
    type: "add-message",
    message: {
      role: "system",
      content: `Say: "Thank you for your time. This concludes the interview. Have a great day." Then stop speaking.`,
    },
  });
}

// ── Feedback ──
async function fetchFeedback() {
  if (feedbackRequested || feedbackGenerated) return;
  feedbackRequested = true;

  document.getElementById("feedback-overlay").classList.add("show");
  showSpinner(true);

  try {
    const res = await fetch(`${API_BASE}/interview/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: interviewState }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || "Failed to generate feedback");
    }

    feedbackGenerated = true;
    document.getElementById("feedback-body").textContent =
      data.feedback || "Could not generate feedback.";
  } catch (err) {
    console.error("fetchFeedback error:", err);
    feedbackRequested = false;
    document.getElementById("feedback-body").textContent =
      "Server error generating feedback.";
  } finally {
    showSpinner(false);
  }
}

// ── Helpers ──
function displayQuestion(text) {
  document.getElementById("question-text").textContent = text;
}

function setStatus(msg, type) {
  document.getElementById("status-msg").textContent = msg;
  const dot = document.getElementById("status-dot");
  dot.className =
    type === "active" ? "active" : type === "recording" ? "recording" : "";
}

function showSpinner(show) {
  document.getElementById("spinner").className = show ? "spinner show" : "spinner";
}

function endCallAndShowFeedback() {
  if (vapi && isCallActive) vapi.stop();
  fetchFeedback();
}

window.startVapiInterview = startVapiInterview;
window.endVapiInterview = endVapiInterview;