const { Router } = require("express");
const multer     = require("multer");
const pdfParse   = require("pdf-parse");
const Entry      = require("../models/entry");

const router = Router();

// Memory storage — keeps file in buffer for PDF parsing
const upload = multer({ storage: multer.memoryStorage() }).single("resume");

router.post("/", upload, async (req, res) => {
  try {
    const { yoe, target_role, target_company } = req.body;

    // Step 1 — extract text from PDF buffer
    const parsed     = await pdfParse(req.file.buffer);
    const resumeText = parsed.text;

    // Step 2 — save directly to MongoDB, no Cloudinary needed
    const newEntry = await Entry.create({
      resume_text: resumeText,
      yoe,
      target_role,
      target_company,
    });

    return res.redirect(`/interview?id=${newEntry._id}`);

  } catch (err) {
    console.error("Entry error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// router.post("/" helped in creation of Entry object , 
router.get("/details", async (req, res) => {
  try {
    const entry = await Entry.findById(req.query.id)
      .select("target_role target_company yoe");
    if (!entry) return res.status(404).json({ error: "Not found" });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;