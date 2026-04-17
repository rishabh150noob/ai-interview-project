// app.js  — main Express entry point
require("dotenv").config();
const express   = require("express");
const mongoose  = require("mongoose");
const path      = require("path");


const app = express();

// ── Middleware ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "views")));  // serve HTML files

// ── MongoDB ──
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// ── Routes ──
app.use("/entry",     require("./routes/entry"));       // form submit → save to DB
app.use("/interview", require("./routes/interview"));   // AI interview API

// ── View pages ──
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "home.html"));
});

app.get("/interview", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "interview.html"));
});

// ── Start ──
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
