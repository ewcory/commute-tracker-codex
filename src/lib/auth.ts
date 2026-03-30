import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { createSession, createUser, deleteSession, getUserBySession, getUserByUsername } from "@/lib/store";

const SESSION_COOKIE = "commute_session";
const SESSION_DAYS = 30;

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export async function registerUser(username: string, password: string) {
  const hash = await bcrypt.hash(password, 12);
  return createUser(username, hash);
}

export async function loginUser(username: string, password: string) {
  const user = await getUserByUsername(username);
  if (!user) {
    return null;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

export async function createSessionForUser(userId: string): Promise<string> {
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  return createSession(userId, expires.toISOString());
}

export async function getAuthUserFromRequest(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return null;
  }
  return getUserBySession(sessionId);
}

export async function clearSessionFromRequest(req: NextRequest) {
  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await deleteSession(sessionId);
  }
}

export function setAuthCookie(res: NextResponse, sessionId: string) {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60
  });
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
