module.exports = function SessionCheck(req, res, next) {
  if (!req.oidc.user) {
    return res.redirect("/login");
  }
  next();
};
