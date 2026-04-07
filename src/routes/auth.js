const express = require("express");
const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const { run, get, all } = require("../db/database");
const { ensureGuest } = require("../middleware/auth");

const router = express.Router();

router.get("/register", ensureGuest, (req, res) => {
  res.render("register", { title: "Register", errors: [], old: {} });
});

router.post(
  "/register",
  ensureGuest,
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("college").trim().notEmpty().withMessage("College is required"),
    body("branch").trim().notEmpty().withMessage("Branch is required"),
    body("year").trim().notEmpty().withMessage("Year is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render("register", {
        title: "Register",
        errors: errors.array(),
        old: req.body,
      });
    }

    const { name, email, password, college, branch, year } = req.body;
    const existing = await get("SELECT id FROM users WHERE email = ?", [email]);

    if (existing) {
      return res.status(400).render("register", {
        title: "Register",
        errors: [{ msg: "Email already exists" }],
        old: req.body,
      });
    }

    const hashed = await bcrypt.hash(password, 10);
    await run(
      "INSERT INTO users (name, email, password, college, branch, year) VALUES (?, ?, ?, ?, ?, ?)",
      [name, email, hashed, college, branch, year]
    );

    return res.redirect("/login");
  }
);

router.get("/login", ensureGuest, (req, res) => {
  res.render("login", { title: "Login", errors: [], old: {} });
});

router.post(
  "/login",
  ensureGuest,
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render("login", {
        title: "Login",
        errors: errors.array(),
        old: req.body,
      });
    }

    const { email, password } = req.body;
    const user = await get("SELECT * FROM users WHERE email = ?", [email]);

    if (!user) {
      return res.status(400).render("login", {
        title: "Login",
        errors: [{ msg: "Invalid credentials" }],
        old: req.body,
      });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).render("login", {
        title: "Login",
        errors: [{ msg: "Invalid credentials" }],
        old: req.body,
      });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch: user.branch,
      year: user.year,
    };

    return res.redirect("/");
  }
);

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

router.get("/profile/:id", async (req, res) => {
  const user = await get(
    "SELECT id, name, email, college, branch, year, created_at FROM users WHERE id = ?",
    [req.params.id]
  );

  if (!user) {
    return res.status(404).render("error", { title: "Not Found", message: "User not found." });
  }

  const uploads = await all(
    "SELECT id, title, subject, likes_count, views_count, created_at FROM notes WHERE user_id = ? ORDER BY created_at DESC",
    [user.id]
  );

  const totals = await get(
    "SELECT COALESCE(SUM(likes_count),0) AS likes_received, COUNT(id) AS uploads_count FROM notes WHERE user_id = ?",
    [user.id]
  );

  const leaderboard = await all(
    `SELECT u.id,
            COALESCE(SUM(n.likes_count),0) AS likes_received,
            COUNT(n.id) AS uploads_count,
            COALESCE(SUM(n.views_count),0) AS views_received,
            (COALESCE(SUM(n.likes_count),0) * 3 + COUNT(n.id) * 2 + COALESCE(SUM(n.views_count),0)) AS score
       FROM users u
       LEFT JOIN notes n ON n.user_id = u.id
      GROUP BY u.id
      ORDER BY score DESC, likes_received DESC`
  );

  const rankIndex = leaderboard.findIndex((x) => x.id === user.id);
  const rank = rankIndex >= 0 ? rankIndex + 1 : "-";

  return res.render("profile", {
    title: `${user.name} Profile`,
    profileUser: user,
    uploads,
    likesReceived: totals.likes_received,
    uploadsCount: totals.uploads_count,
    rank,
  });
});

module.exports = router;
