import express from "express";
import { supabase } from "../services/supabaseClient.js";
import { hashPassword, comparePassword, generateToken } from "../services/authService.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Helper to validate email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
}

// POST /api/auth/signup — Create a new user account (Unique Email, non-unique Username)
router.post("/signup", async (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: email, username, password",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const cleanUsername = String(username).trim();
    const passwordStr = String(password);

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        error: "Please provide a valid email address",
      });
    }

    if (cleanUsername.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Username must be at least 2 characters",
      });
    }

    if (passwordStr.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters",
      });
    }

    // Check if email is already registered (Email must be unique)
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "An account with this email already exists",
      });
    }

    // Hash password and insert user (username can be duplicated across different emails)
    const password_hash = await hashPassword(passwordStr);

    const { data: user, error } = await supabase
      .from("users")
      .insert({
        email: normalizedEmail,
        username: cleanUsername,
        password_hash,
      })
      .select("id, email, username, created_at")
      .single();

    if (error) throw new Error(error.message);

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: { user, token },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/login — Authenticate using unique email and password
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: email, password",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const passwordStr = String(password);

    // Find user by unique email
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", normalizedEmail)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    // Compare password
    const valid = await comparePassword(passwordStr, user.password_hash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: "Logged in successfully",
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          created_at: user.created_at,
        },
        token,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/auth/me — Get profile of currently logged-in user
router.get("/me", requireAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/auth/users — List all users (requires auth)
router.get("/users", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, username, created_at")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
