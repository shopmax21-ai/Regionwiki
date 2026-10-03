import { jwtVerify, SignJWT } from "jose";

import { SESSION_MAX_AGE } from "./config";

export type AccessStatus = "pending" | "approved" | "rejected";
export type AccessRole = "user" | "admin";

export type SessionUser = {
  /** Telegram ID */
  id: string;
  name: string;
  username?: string;
  status: AccessStatus;
  role: AccessRole;
  /** Когда выдан токен (секунды), нужно для периодической сверки с базой */
  issuedAt: number;
};

const encode = (secret: string) => new TextEncoder().encode(secret);

export async function createSessionToken(user: Omit<SessionUser, "issuedAt">, secret: string): Promise<string> {
  return new SignJWT({ name: user.name, username: user.username, status: user.status, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(encode(secret));
}

export async function readSessionToken(token: string, secret: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, encode(secret), { algorithms: ["HS256"] });
    if (!payload.sub) return null;

    const status = payload.status === "approved" || payload.status === "rejected" ? payload.status : "pending";
    return {
      id: payload.sub,
      name: typeof payload.name === "string" ? payload.name : payload.sub,
      username: typeof payload.username === "string" ? payload.username : undefined,
      status,
      role: payload.role === "admin" ? "admin" : "user",
      issuedAt: typeof payload.iat === "number" ? payload.iat : 0,
    };
  } catch {
    return null;
  }
}
