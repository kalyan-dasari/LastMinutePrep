const express = require("express");
const path = require("path");
const fs = require("fs");
const { ensureAuth, ensureAdmin } = require("../middleware/auth");
const { all, get, run } = require("../db/database");
const { deleteStoredFile } = require("../lib/storage");

const router = express.Router();
const isVercel = Boolean(process.env.VERCEL);
const uploadRoot = isVercel ? path.join("/tmp", "uploads") : path.join(__dirname, "..", "..", "uploads");

router.get("/dashboard", ensureAuth, async (req, res) => {
  const uploads = await all(
    `SELECT id, title, subject, likes_count, views_count, created_at
       FROM notes
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10`,
    [req.session.user.id]
  );

  const totals = await get(
    `SELECT COUNT(id) AS uploads_count,
            COALESCE(SUM(likes_count),0) AS likes_received,
            COALESCE(SUM(views_count),0) AS views_received
       FROM notes
      WHERE user_id = ?`,
    [req.session.user.id]
  );

  const leaderboard = await all(
    `SELECT u.id,
            (COALESCE(SUM(n.likes_count),0) * 3 + COUNT(n.id) * 2 + COALESCE(SUM(n.views_count),0)) AS score
       FROM users u
       LEFT JOIN notes n ON n.user_id = u.id
      GROUP BY u.id
      ORDER BY score DESC`
  );

  const rankIndex = leaderboard.findIndex((x) => x.id === req.session.user.id);
  const rank = rankIndex >= 0 ? rankIndex + 1 : "-";

  res.render("dashboard", {
    title: "Dashboard",
    uploads,
    totals,
    rank,
  });
});

router.get("/admin", ensureAuth, ensureAdmin, async (_req, res) => {
  const notes = await all(
    `SELECT n.id, n.title, n.subject, n.created_at, u.name AS contributor_name
       FROM notes n
       JOIN users u ON u.id = n.user_id
      ORDER BY n.created_at DESC`
  );

  const users = await all(
    `SELECT id, name, email, branch, year, role, created_at
       FROM users
      ORDER BY created_at DESC`
  );

  res.render("admin", { title: "Admin Panel", notes, users });
});

router.post("/admin/notes/:id/delete", ensureAuth, ensureAdmin, async (req, res) => {
  const note = await get("SELECT file_path, storage_path FROM notes WHERE id = ?", [req.params.id]);
  if (note) {
    await deleteStoredFile(note);
    if (note.file_path && note.file_path.startsWith("/uploads/")) {
      const fileName = path.basename(note.file_path);
      const absolutePath = path.join(uploadRoot, fileName);
      fs.unlink(absolutePath, () => {});
    }
    await run("DELETE FROM comments WHERE note_id = ?", [req.params.id]);
    await run("DELETE FROM likes WHERE note_id = ?", [req.params.id]);
    await run("DELETE FROM notes WHERE id = ?", [req.params.id]);
  }
  res.redirect("/admin");
});

router.post("/admin/users/:id/delete", ensureAuth, ensureAdmin, async (req, res) => {
  const user = await get("SELECT id, role FROM users WHERE id = ?", [req.params.id]);
  if (user && user.role !== "admin") {
    await run("DELETE FROM comments WHERE user_id = ?", [req.params.id]);
    await run("DELETE FROM likes WHERE user_id = ?", [req.params.id]);
    await run("DELETE FROM notes WHERE user_id = ?", [req.params.id]);
    await run("DELETE FROM users WHERE id = ?", [req.params.id]);
  }
  res.redirect("/admin");
});

module.exports = router;
