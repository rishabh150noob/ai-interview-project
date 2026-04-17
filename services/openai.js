// services/openai.js
// OpenAI client — used by the interview route

const OpenAI = require("openai");

const openai = new OpenAI({
    apiKey:  process.env.GROK_API_KEY,
  baseURL: "https://api.groq.com/openai/v1", 
});


module.exports = openai;
