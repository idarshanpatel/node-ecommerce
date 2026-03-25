// createUser.js
const axios = require("axios");

async function createUser(token, user) {
  await axios.post(
    `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users`,
    {
      username: user.email,
      email: user.email,
      enabled: true,
      emailVerified: true,

      firstName: user.firstName,
      lastName: user.lastName,

      // Attributes MUST be strings
      attributes: {
        legacyUserId: String(user.legacyUserId),   // ✅ fixed
        migrated: "true",                  // ✅ added
        passwordInitialized: "false"       // ✅ fixed
      }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );
}

module.exports = createUser;
