import { jwtVerify, SignJWT } from "jose";

import { SESSION_MAX_AGE } from "./config";

export type SessionUser = {
  /** Telegram ID */
  id: string;
  name: string;
  username?: string;
  picture?: string;
};

const encode = (secret: string) => new TextEncoder().encode(secret);

export async function createSessionToken(user: SessionUser, secret: string): Promise<string> {
  return new SignJWT({ name: user.name, username: user.username, picture: user.picture })
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

    return {
      id: payload.sub,
      name: typeof payload.name === "string" ? payload.name : payload.sub,
      username: typeof payload.username === "string" ? payload.username : undefined,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
    };
  } catch {
    return null;
  }
}
