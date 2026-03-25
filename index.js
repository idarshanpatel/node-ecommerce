const express = require('express');
const axios = require('axios');
const { authMiddleware } = require('./auth.middleware');
const { getAdminToken } = require("./keycloak.service");


require('dotenv').config()

const app = express();
const PORT = 3500;


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    console.log(process.env.OIDC_CLIENT_ID)
  res.send('Hello World this is for skycloak!');
});

app.get('/thank-you', (req, res) => {
  res.send('Hello World this is thank you end point!');
});

/*
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
    const response = await axios.post(
      'http://localhost:8081/realms/dev-app-realm/protocol/openid-connect/token',
      new URLSearchParams({
        grant_type: "password",
        client_id: process.env.OIDC_CLIENT_ID,
        client_secret: process.env.OIDC_CLIENT_SECRET,
        username: email,
        password: password
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    console.log("response-->", response.data)

    res.json({
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in
    });

  } catch (err) {
    console.log("err-->",err)
    res.status(401).json({ message: "Invalid credentials" });
  }
});
*/

async function getUserByEmail(email, adminToken) {
  const res = await axios.get(
    `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users`,
    {
      params: { username: email },
      headers: { Authorization: `Bearer ${adminToken}` }
    }
  );

   const basicUser = res.data?.[0];
   console.log("basicUser-->",basicUser);
   if (!basicUser) return null;

   const fullRes = await axios.get(
    `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users/${basicUser.id}`,
    {
      headers: { Authorization: `Bearer ${adminToken}` }
    }
  );
  console.log("fullRes-->", fullRes)
  return fullRes.data; 
}

async function sendPasswordResetEmail(userId, adminToken) {
  await axios.put(
    `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users/${userId}/execute-actions-email`,
    ["UPDATE_PASSWORD"],
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      }
    }
  );
}


async function loginWithPassword(email, password) {
   try {
    const response = await axios.post(
      'http://localhost:8081/realms/dev-app-realm/protocol/openid-connect/token',
      new URLSearchParams({
        grant_type: "password",
        client_id: process.env.OIDC_CLIENT_ID,
        client_secret: process.env.OIDC_CLIENT_SECRET,
        username: email,
        password: password
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    console.log("response tttt-->", response.data)

    return response.data.access_token;

  } catch (err) {
    console.log("err-->",err)
    res.status(401).json({ message: "Invalid credentials" });
  }
  
}


app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const adminToken = await getAdminToken();
  console.log("Admin token-->", adminToken)
  const user = await getUserByEmail(email, adminToken);
  console.log("User new-->", user)

  if (!user) {
    throw {
      code: "USER_NOT_FOUND",
      message: "User does not exist"
    };
  }

  // 🔥 MIGRATED USER CHECK
  const isMigratedUser =
  user.attributes?.passwordInitialized?.[0] === "false";

  console.log(
  "passwordInitialized value:",
  user.attributes?.passwordInitialized
);

  if (isMigratedUser) {
    await sendPasswordResetEmail(user.id, adminToken);

    return {
      code: "PASSWORD_RESET_REQUIRED",
      message: "We’ve sent you an email to set your password."
    };
  }

  // ✅ NORMAL USER LOGIN
  try {
    console.log("Attempting normal login for user:", email+password);
    const token = await loginWithPassword(email, password);
    console.log("Token-->", token);
    return {
      code: "LOGIN_SUCCESS",
      token
    };
  } catch (err) {
    throw {
      code: "INVALID_CREDENTIALS",
      message: "Invalid email or password"
    };
  }
});

app.post('/register',async (req, res) => {
    const { email, password, firstName, lastName } = req.body;

  try {
    const adminToken = await getAdminToken();
    console.log("Admin token-->", adminToken)
    // Create user
    const createRes = await axios.post(
      `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users`,
      {
        username: email,
        email: email,
        firstName,
        lastName,
        enabled: true,
        emailVerified: true
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );
    
    const userId = createRes.headers.location.split("/").pop();
    console.log("Created user ID-->", userId)

    // Set password
    await axios.put(
      `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users/${userId}/reset-password`,
      {
        type: "password",
        value: password,
        temporary: false
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    res.json({ message: "User registered successfully" });

  } catch (err) {
    if (err.response?.status === 409) {
      return res.status(409).json({ message: "User already exists" });
    }
    console.error(err.response?.data || err.message);
    res.status(500).json({ message: "Registration failed" });
  }
});

app.post('/changePassword', authMiddleware,async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.sub;

  try {
    // Verify old password by re-login
    await axios.post(
      `${process.env.KEYCLOAK_URL}/realms/${process.env.REALM}/protocol/openid-connect/token`,
      new URLSearchParams({
        grant_type: "password",
        client_id: process.env.OIDC_CLIENT_ID,
        client_secret: process.env.OIDC_CLIENT_SECRET,
        username: req.user.email,
        password: oldPassword
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const adminToken = await getAdminToken();

    await axios.put(
      `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users/${userId}/reset-password`,
      {
        type: "password",
        value: newPassword,
        temporary: false
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    res.json({ message: "Password changed successfully" });

  } catch (err) {
    res.status(400).json({ message: "Password change failed" });
  }
})

async function isMigratedUser(email, adminToken) {
  const res = await axios.get(
    `${process.env.KEYCLOAK_URL}/admin/realms/${process.env.REALM}/users`,
    {
      params: { username: email },
      headers: { Authorization: `Bearer ${adminToken}` }
    }
  );

  const user = res.data?.[0];
  if (!user) return false;

  return user.attributes?.passwordInitialized?.[0] === "false";
}


/*
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
*/

app.get("/me", authMiddleware, async (req, res) => {
  res.json({
    id: req.user.sub,
    email: req.user.email,
    name: req.user.name
  });
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
