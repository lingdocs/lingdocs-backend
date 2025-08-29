import { hash, compare } from "bcryptjs";
import { randomBytes } from "crypto";
import base64url from "base64url";
import { type AT } from "@lingdocs/auth-shared";

const tokenSize = 24;

export async function getHash(p: string): Promise<AT.Hash> {
  return (await hash(p, 10)) as AT.Hash;
}

export async function getEmailTokenAndHash(): Promise<{
  token: AT.URLToken;
  hash: AT.Hash;
}> {
  const token = getURLToken();
  const h = await getHash(token);
  return { token, hash: h };
}

export function getURLToken(): AT.URLToken {
  return base64url(randomBytes(tokenSize)) as AT.URLToken;
}

export function compareToHash(s: string, hash: AT.Hash): Promise<boolean> {
  return compare(s, hash);
}
