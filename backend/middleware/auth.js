
const jwt = require("jsonwebtoken");

function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "خاصك تسجل الدخول أولا"
    });
  }

  try {
    const token = header.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = { id: decoded.id };
    next();
  } catch {
    return res.status(401).json({
      message: "Session غير صالحة، عاود سجل الدخول"
    });
  }
}

module.exports = auth;
