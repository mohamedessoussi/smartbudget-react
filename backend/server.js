
require("dotenv").config();

const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("./middleware/auth");

const app = express();

app.use(cors({
  origin: "http://localhost:5173"
}));
app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

app.get("/", (req, res) => {
  res.json({ message: "SmartBudget API is running" });
});

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        message: "دخل الاسم والإيميل وكلمة سر فيها 8 أحرف على الأقل"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [existing] = await db.execute(
      "SELECT id FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: "هاد الإيميل مسجل من قبل"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await db.execute(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name.trim(), normalizedEmail, hashedPassword]
    );

    res.status(201).json({
      message: "الحساب تخلق بنجاح",
      user: {
        id: result.insertId,
        name: name.trim(),
        email: normalizedEmail
      }
    });
  } catch (error) {
    console.error("Register error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "هاد الإيميل مسجل من قبل"
      });
    }

    res.status(500).json({ message: "وقع خطأ فالسيرفر" });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "دخل الإيميل وكلمة السر"
      });
    }

    const [rows] = await db.execute(
      "SELECT id, name, email, password FROM users WHERE email = ?",
      [email.trim().toLowerCase()]
    );

    if (
      rows.length === 0 ||
      !(await bcrypt.compare(password, rows[0].password))
    ) {
      return res.status(401).json({
        message: "الإيميل أو كلمة السر غير صحيحة"
      });
    }

    const user = rows[0];

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      message: "تسجل الدخول بنجاح",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "وقع خطأ فالسيرفر" });
  }
});

// CURRENT USER
app.get("/api/auth/me", auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT id, name, email FROM users WHERE id = ?",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "المستخدم ما بقاش موجود"
      });
    }

    res.json({ user: rows[0] });
  } catch (error) {
    console.error("User error:", error);
    res.status(500).json({ message: "وقع خطأ فالسيرفر" });
  }
});

// GET TRANSACTIONS
app.get("/api/transactions", auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, title, amount, type, category,
       DATE_FORMAT(transaction_date, '%Y-%m-%d') AS date
       FROM transactions
       WHERE user_id = ?
       ORDER BY transaction_date DESC, id DESC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ message: "تعذر جلب العمليات" });
  }
});

// ADD TRANSACTION
app.post("/api/transactions", auth, async (req, res) => {
  try {
    const { title, amount, type, category, date } = req.body;
    const parsedAmount = Number(amount);

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 150 ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0 ||
      !["income", "expense"].includes(type) ||
      typeof category !== "string" ||
      !category.trim() ||
      category.trim().length > 100 ||
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date + "T00:00:00Z")) ||
      new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date
    ) {
      return res.status(400).json({
        message: "المعلومات ديال العملية غير صحيحة"
      });
    }

    const [result] = await db.execute(
      `INSERT INTO transactions
       (user_id, title, amount, type, category, transaction_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        title.trim(),
        parsedAmount,
        type,
        category.trim(),
        date
      ]
    );

    res.status(201).json({
      id: result.insertId,
      title: title.trim(),
      amount: parsedAmount,
      type,
      category: category.trim(),
      date
    });
  } catch (error) {
    console.error("Add error:", error);
    res.status(500).json({ message: "تعذر إضافة العملية" });
  }
});

// DELETE TRANSACTION
app.delete("/api/transactions/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "رقم العملية غير صحيح"
      });
    }

    const [result] = await db.execute(
      "DELETE FROM transactions WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "العملية ما لقاهاش السيرفر"
      });
    }

    res.json({ message: "تم حذف العملية بنجاح" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ message: "تعذر حذف العملية" });
  }
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    const connection = await db.getConnection();
    console.log("MySQL connected successfully");
    connection.release();

    app.listen(PORT, () => {
      console.log(`SmartBudget API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MySQL connection failed:", error.message);
    process.exit(1);
  }
}

startServer();
