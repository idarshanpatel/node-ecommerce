require("dotenv").config();
const fs = require("fs");
const csv = require("csv-parser");

const { getAdminToken } = require("./keycloak.service");
const createUser = require("./createUser");

async function migrate() {
  const token = await getAdminToken();
  const users = [];

  fs.createReadStream("users.csv")
    .pipe(csv())
    .on("data", (row) => users.push(row))
    .on("end", async () => {
      for (const user of users) {
        try {
          await createUser(token, user);
          console.log(`✅ Created: ${user.email}`);
        } catch (e) {
            console.log("ee-->",e)
          if (e.response?.status === 409) {
            console.log(`⚠️ Exists: ${user.email}`);
          } else {
            console.error(`❌ Error: ${user.email}`, e.response?.data);
          }
        }
      }
    });
}

migrate();
