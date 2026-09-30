import "server-only";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Constant-cost dummy hash compared against when a login targets a non-existent account,
 * so response timing does not reveal whether an email is registered.
 */
export const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO7oVi3pbZK1IvfOjnzHA06xSZA6w9Qwe";
