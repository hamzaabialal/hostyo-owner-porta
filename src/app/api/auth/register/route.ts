import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password + process.env.NEXTAUTH_SECRET).digest("hex");
}

async function getUsers(): Promise<User[]> {
  try {
    const data = await readFile(USERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveUsers(users: User[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ ok: false, error: "All fields are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const users = await getUsers();

    // Check if email already exists
    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return NextResponse.json({ ok: false, error: "An account with this email already exists" }, { status: 400 });
    }

    // Create user
    const newUser: User = {
      id: `user_${Date.now()}`,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await saveUsers(users);

    return NextResponse.json({ ok: true, userId: newUser.id });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ ok: false, error: "Registration failed" }, { status: 500 });
  }
}
