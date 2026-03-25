const axios = require('axios');

async function getAdminToken() {
  const res = await axios.post(
    'http://localhost:8081/realms/dev-app-realm/protocol/openid-connect/token',
    new URLSearchParams({
      grant_type: "client_credentials",
      client_id: 'node-api-client',
      client_secret: 'LxxZwcqNmE1yfI5pIXU6nhDF192s2RmA'
    })
  );
  return res.data.access_token;
}

module.exports = { getAdminToken };