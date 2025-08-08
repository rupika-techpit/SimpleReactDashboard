// import Express from "express";
// const app = Express();
const port = process.env.X_ZOHO_CATALYST_LISTEN_PORT || 9000;

// app.get('/', (req, res) => {
//   res.send('Hello World!')
// });

// app.listen(port, () => {
//   console.log(`Example app listening on port ${port}`);
//   console.log(`http://localhost:${port}/`);
// });

import express from "express";
import catalyst from "zcatalyst-sdk-node";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config(); // Load env vars

const app = express();

// Try this more explicit CORS configuration
// app.use(
//   cors({
//     origin:
//       "https://fullstackauth-827123197.development.catalystserverless.com",
//     credentials: true,
//   })
// );

app.use(express.json());
app.use(cookieParser());

// Table and column names
const tableName = "Registration";
const emailCol = "registeredEmail";
const usernameCol = "userID";
const passwordCol = "password";
const terms = "terms";

// Secret key for JWT
const JWT_SECRET = 'your_secret_key'; // 🔐 In production, store in env variable

app.get("/", async (req, res) => {
  res.send("Fetched and logged all users in the console.");
});

// SIGN UP
app.post("/signup", async (req, res) => {
  console.log("Received body:", req.body); // Add this for debug

  const { email, username, password, terms } = req.body;
  if (!email || !username || !password || !terms) {
    return res.status(400).send({ message: "Missing fields" });
  }

  const catalystApp = catalyst.initialize(req);

  try {
    const exists = await checkUserExists(catalystApp, email);
    if (exists) {
      return res.status(400).send({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = [
      {
        [emailCol]: email,
        [usernameCol]: username,
        [passwordCol]: hashedPassword,
        [terms]: terms,
      },
    ];

    await catalystApp.datastore().table(tableName).insertRows(newUser);
    res.send({ message: "Signup successful!" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const catalystApp = catalyst.initialize(req);

  try {
    const query = `SELECT * FROM ${tableName} WHERE ${emailCol}='${email}'`;
    const result = await catalystApp.zcql().executeZCQLQuery(query);

    if (result.length === 0) {
      return res.status(401).send({ message: "result not found" });
    }

    console.log(result);

    const user = Object.values(result[0])[0];
    const hash = user[passwordCol];
    console.log({ password, hash });

    const passwordMatch = await bcrypt.compare(password, hash);

    if (!passwordMatch) {
      return res.status(401).send({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign({ email: user[emailCol] }, process.env.JWT_SECRET, {
      expiresIn: "30s",
    });

    // Send token in HTTP-only cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // Set to true in production (HTTPS)
      maxAge: 30000,
    });

    res.send({ message: "Login successful!" });
  } catch (err) {
    console.error(err);
    // sendErrorResponse(res);
  }
});

// MIDDLEWARE - Verify Token
function authenticateToken(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Example protected route
app.get("/profile", authenticateToken, (req, res) => {
  res.send({ message: `Welcome, ${req.user.email}` });
});

// Utility: check if user exists
function checkUserExists(catalystApp, email) {
  const query = `SELECT * FROM ${tableName} WHERE ${emailCol}='${email}'`;
  return catalystApp
    .zcql()
    .executeZCQLQuery(query)
    .then((result) => result.length > 0);
}

// Utility: error response
function sendErrorResponse(res) {
  res.status(500).send({
    error: "Internal server error occurred. Please try again later.",
  });
}

const PORT = process.env.X_ZOHO_CATALYST_LISTEN_PORT || 9000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
