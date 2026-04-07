const path = require("path");
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const { body, validationResult } = require("express-validator");
const { ensureAuth } = require("../middleware/auth");
const { run, get, all } = require("../db/database");
const { uploadPdf } = require("../lib/storage");

const router = express.Router();
const isVercel = Boolean(process.env.VERCEL);
const uploadRoot = isVercel ? path.join("/tmp", "uploads") : path.join(__dirname, "..", "..", "uploads");

fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadRoot);
  },
  filename: (_req, file, cb) => {
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${stamp}-${file.originalname.replace(/\s+/g, "_")}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf" || path.extname(file.originalname).toLowerCase() === ".pdf") {
      return cb(null, true);
    }
    return cb(new Error("Only PDF files are allowed"));
  },
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

function buildFilters(query) {
  const conditions = [];
  const params = [];

  if (query.subject) {
    conditions.push("n.subject = ?");
    params.push(query.subject);
  }
  if (query.branch) {
    conditions.push("n.branch = ?");
    params.push(query.branch);
  }
  if (query.year) {
    conditions.push("n.year = ?");
    params.push(query.year);
  }
  if (query.exam_type) {
    conditions.push("n.exam_type = ?");
    params.push(query.exam_type);
  }
  if (query.q) {
    conditions.push("(n.title LIKE ? OR n.subject LIKE ? OR n.description LIKE ?)");
    const like = `%${query.q}%`;
    params.push(like, like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

router.get("/", async (req, res) => {
  const { where, params } = buildFilters(req.query);

  let sort = "n.created_at DESC";
  if (req.query.sort === "liked") sort = "n.likes_count DESC, n.created_at DESC";
  if (req.query.sort === "viewed") sort = "n.views_count DESC, n.created_at DESC";

  const notes = await all(
    `SELECT n.*, u.name AS contributor_name
       FROM notes n
       JOIN users u ON u.id = n.user_id
       ${where}
      ORDER BY ${sort}`,
    params
  );

  const subjects = await all("SELECT DISTINCT subject FROM notes ORDER BY subject");
  const branches = await all("SELECT DISTINCT branch FROM notes ORDER BY branch");

  res.render("home", {
    title: "LastMinutePrep",
    notes,
    filters: req.query,
    subjects: subjects.map((x) => x.subject),
    branches: branches.map((x) => x.branch),
  });
});

router.get("/upload", ensureAuth, (_req, res) => {
  res.render("upload", { title: "Upload Notes", errors: [], old: {} });
});

router.post(
  "/upload",
  ensureAuth,
  upload.single("pdf_file"),
  [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("subject").trim().notEmpty().withMessage("Subject is required"),
    body("branch").trim().notEmpty().withMessage("Branch is required"),
    body("year").trim().notEmpty().withMessage("Year is required"),
    body("exam_type").trim().notEmpty().withMessage("Exam type is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      return res.status(400).render("upload", {
        title: "Upload Notes",
        errors: errors.array(),
        old: req.body,
      });
    }

    if (!req.file) {
      return res.status(400).render("upload", {
        title: "Upload Notes",
        errors: [{ msg: "PDF file is required" }],
        old: req.body,
      });
    }

    const { title, subject, branch, year, exam_type, description } = req.body;
    const uploadedFile = await uploadPdf({
      localPath: req.file.path,
      fileName: path.basename(req.file.path),
      contentType: req.file.mimetype,
    });

    if (isVercel) {
      fs.unlink(req.file.path, () => {});
    }

    await run(
      `INSERT INTO notes (user_id, title, subject, branch, year, exam_type, description, file_path, storage_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.user.id,
        title,
        subject,
        branch,
        year,
        exam_type,
        description || "",
        uploadedFile.publicUrl,
        uploadedFile.storagePath,
      ]
    );

    return res.redirect("/");
  }
);

router.get("/notes/:id", async (req, res) => {
  const note = await get(
    `SELECT n.*, u.name AS contributor_name, u.id AS contributor_id
       FROM notes n
       JOIN users u ON u.id = n.user_id
      WHERE n.id = ?`,
    [req.params.id]
  );

  if (!note) {
    return res.status(404).render("error", { title: "Not Found", message: "Note not found." });
  }

  await run("UPDATE notes SET views_count = views_count + 1 WHERE id = ?", [req.params.id]);
  note.views_count += 1;

  const comments = await all(
    `SELECT c.id,
            c.comment,
            c.created_at,
            u.name AS display_name
       FROM comments c
       JOIN users u ON u.id = c.user_id
      WHERE c.note_id = ?
      UNION ALL
     SELECT gc.id,
            gc.comment,
            gc.created_at,
            gc.guest_name AS display_name
       FROM guest_comments gc
      WHERE gc.note_id = ?
      ORDER BY created_at DESC`,
    [req.params.id, req.params.id]
  );

  let likedByMe = false;
  if (req.session.user) {
    const existing = await get("SELECT id FROM likes WHERE user_id = ? AND note_id = ?", [
      req.session.user.id,
      req.params.id,
    ]);
    likedByMe = Boolean(existing);
  } else {
    const guestLike = await get("SELECT id FROM guest_likes WHERE guest_token = ? AND note_id = ?", [
      req.session.guestToken,
      req.params.id,
    ]);
    likedByMe = Boolean(guestLike);
  }

  return res.render("note-detail", {
    title: note.title,
    note,
    comments,
    likedByMe,
  });
});

router.post("/notes/:id/like", async (req, res) => {
  const noteId = Number(req.params.id);
  const redirectTo = req.body.redirect_to || req.get("referer") || `/notes/${noteId}`;

  const note = await get("SELECT id FROM notes WHERE id = ?", [noteId]);
  if (!note) return res.status(404).redirect("/");

  if (req.session.user) {
    const existing = await get("SELECT id FROM likes WHERE user_id = ? AND note_id = ?", [req.session.user.id, noteId]);
    if (!existing) {
      await run("INSERT INTO likes (user_id, note_id) VALUES (?, ?)", [req.session.user.id, noteId]);
      await run("UPDATE notes SET likes_count = likes_count + 1 WHERE id = ?", [noteId]);
    }
  } else {
    const existingGuest = await get("SELECT id FROM guest_likes WHERE guest_token = ? AND note_id = ?", [
      req.session.guestToken,
      noteId,
    ]);
    if (!existingGuest) {
      await run("INSERT INTO guest_likes (guest_token, note_id) VALUES (?, ?)", [req.session.guestToken, noteId]);
      await run("UPDATE notes SET likes_count = likes_count + 1 WHERE id = ?", [noteId]);
    }
  }

  return res.redirect(redirectTo);
});

router.post(
  "/notes/:id/comment",
  [body("comment").trim().isLength({ min: 2 }).withMessage("Comment is too short")],
  async (req, res) => {
    const errors = validationResult(req);
    const noteId = Number(req.params.id);

    if (!errors.isEmpty()) {
      return res.redirect(`/notes/${noteId}`);
    }

    if (req.session.user) {
      await run("INSERT INTO comments (user_id, note_id, comment) VALUES (?, ?, ?)", [
        req.session.user.id,
        noteId,
        req.body.comment,
      ]);
    } else {
      const guestName = (req.body.guest_name || "Guest Student").trim().slice(0, 50) || "Guest Student";
      await run("INSERT INTO guest_comments (note_id, guest_name, comment) VALUES (?, ?, ?)", [
        noteId,
        guestName,
        req.body.comment,
      ]);
    }

    return res.redirect(`/notes/${noteId}`);
  }
);

router.get("/leaderboard", async (_req, res) => {
  const board = await all(
    `SELECT u.id,
            u.name,
            u.branch,
            COUNT(n.id) AS uploads_count,
            COALESCE(SUM(n.likes_count),0) AS likes_received,
            COALESCE(SUM(n.views_count),0) AS views_received,
            (COALESCE(SUM(n.likes_count),0) * 3 + COUNT(n.id) * 2 + COALESCE(SUM(n.views_count),0)) AS score
       FROM users u
       LEFT JOIN notes n ON n.user_id = u.id
      GROUP BY u.id, u.name, u.branch
      ORDER BY score DESC, likes_received DESC
      LIMIT 25`
  );

  res.render("leaderboard", { title: "Leaderboard", board });
});

router.get("/categories", async (_req, res) => {
  const categories = await all(
    `SELECT s.subject,
            s.note_count,
            s.likes,
            (
              SELECT id
                FROM notes n2
               WHERE n2.subject = s.subject
               ORDER BY n2.likes_count DESC, n2.created_at DESC
               LIMIT 1
            ) AS featured_note_id,
            (
              SELECT title
                FROM notes n3
               WHERE n3.subject = s.subject
               ORDER BY n3.likes_count DESC, n3.created_at DESC
               LIMIT 1
            ) AS featured_title,
            (
              SELECT file_path
                FROM notes n4
               WHERE n4.subject = s.subject
               ORDER BY n4.likes_count DESC, n4.created_at DESC
               LIMIT 1
            ) AS featured_file_path
       FROM (
         SELECT subject,
                COUNT(*) AS note_count,
                COALESCE(SUM(likes_count),0) AS likes
           FROM notes
          GROUP BY subject
       ) s
      ORDER BY s.note_count DESC, s.subject ASC`
  );

  res.render("categories", { title: "Categories", categories });
});

router.get("/last-minute", async (_req, res) => {
  const topLiked = await all(
    `SELECT n.*, u.name AS contributor_name
       FROM notes n
       JOIN users u ON u.id = n.user_id
      ORDER BY n.likes_count DESC, n.views_count DESC
      LIMIT 20`
  );

  const shortSummaries = await all(
    `SELECT n.*, u.name AS contributor_name,
            LENGTH(COALESCE(n.description, '')) AS summary_length
       FROM notes n
       JOIN users u ON u.id = n.user_id
      WHERE TRIM(COALESCE(n.description, '')) <> ''
      ORDER BY summary_length ASC
      LIMIT 20`
  );

  res.render("last-minute", {
    title: "Last Minute Mode",
    topLiked,
    shortSummaries,
  });
});

router.get("/admin-note", (_req, res) => {
  res.render("admin-note", { title: "Admin Note" });
});

module.exports = router;
