import "server-only";
import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing (argon2id, native). Node-only — never import this into middleware
 * (edge runtime) or client code. Used by the login action and the seed-owner script.
 */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export function verifyPassword(hashStr: string, plain: string): Promise<boolean> {
  return verify(hashStr, plain);
}
