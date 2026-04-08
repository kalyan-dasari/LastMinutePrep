const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const dotenv = require("dotenv");
const notesRoutes = require("./routes/notes");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const { initDb } = require("./db/database");

dotenv.config();

const app = express();
const isVercel = Boolean(process.env.VERCEL);
const uploadsDir = isVercel ? path.join("/tmp", "uploads") : path.join(__dirname, "..", "uploads");

fs.mkdirSync(uploadsDir, { recursive: true });

if (isVercel || process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "..", "public")));
app.use("/uploads", express.static(uploadsDir));

const sessionConfig = {
  secret: process.env.SESSION_SECRET || "lastminuteprep-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
  },
};

if (!isVercel) {
  sessionConfig.store = new SQLiteStore({ db: "sessions.db", dir: "./data" });
}

app.use(session(sessionConfig));

app.use((req, res, next) => {
  if (!req.session.guestToken) {
    req.session.guestToken = crypto.randomUUID();
  }
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPath = req.path;
  next();
});

app.use(authRoutes);
app.use(notesRoutes);
app.use(userRoutes);

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.message && err.message.includes("Only PDF")) {
    return res.status(400).render("upload", {
      title: "Upload Notes",
      errors: [{ msg: err.message }],
      old: req.body || {},
    });
  }

  console.error(err);
  return res.status(500).render("error", {
    title: "Server Error",
    message: "Something went wrong. Please try again.",
  });
});

async function bootstrap() {
  await initDb();
}

module.exports = {
  app,
  bootstrap,
};
