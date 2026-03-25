// auth.middleware.js
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');



const jwks = jwksClient({
  jwksUri: 'http://localhost:8081/realms/dev-app-realm/protocol/openid-connect/certs'
});

function getKey(header, cb) {
  jwks.getSigningKey(header.kid, function (err, key) {
    cb(null, key.getPublicKey());
  });
}

exports.authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Missing Authorization header" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Missing Bearer token" });
  }

  jwt.verify(token, getKey, { algorithms: ["RS256"] }, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Attach user info to request
    req.user = decoded;
    next();
  });
}
