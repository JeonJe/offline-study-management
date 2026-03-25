const MASTER_OVERRIDE_PASSWORDS = new Set(["갈!", "rkf!"]);

export function isMasterOverridePassword(password?: string | null): boolean {
  const normalized = (password?.trim() ?? "")
    .replaceAll("！", "!");

  return MASTER_OVERRIDE_PASSWORDS.has(normalized);
}
