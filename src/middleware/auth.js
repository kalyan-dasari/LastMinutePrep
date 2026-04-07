function ensureAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  return next();
}

function ensureGuest(req, res, next) {
  if (req.session.user) {
    return res.redirect("/");
  }
  return next();
}

function ensureAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).render("error", {
      title: "Access Denied",
      message: "You are not authorized to view this page.",
    });
  }
  return next();
}

module.exports = {
  ensureAuth,
  ensureGuest,
  ensureAdmin,
};
