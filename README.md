An end-to-end AI-powered interview platform that conducts real-time technical interviews using speech processing and dynamic question generation.


Real-time voice-based interview interaction
•	 AI-generated follow-up questions based on candidate responses
•	 Stateful interview engine to track progress
•	 Dynamic question flow (not pre-defined)
•	 Debounced answer processing to handle real-time streaming issues
•	 Clean frontend with live interaction controls

 Tech Stack
•	Backend: Node.js, Express
•	Frontend: HTML, JS (Vanilla)
•	AI Integration: OpenAI API
•	Architecture: MVC + Service Layer

Core Concept
The system simulates a real interviewer:
1.	Starts interview session
2.	Asks a question
3.	Listens to candidate response (via transcript)
4.	Processes answer
5.	Generates next question dynamically
6.	when the interview is ended ( either by the system or when the user click the "end interview " button) it generates a feedback

Engineering Challenge: Race Condition in Speech Processing
During real-time speech input, multiple "final transcript" events were triggered rapidly for a single answer.
This caused:
•	Duplicate answer submissions
•	Multiple API calls
•	Broken interview flow

We implemented a debouncing strategy to ensure only one response is processed:
clearTimeout(answerTimer);

answerTimer = setTimeout(() => {
  processAnswer();
}, 1500);








