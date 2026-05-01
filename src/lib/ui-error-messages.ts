export const UI_ERROR_MESSAGES = {
  databaseMissing:
    "데이터베이스 연결 설정이 없어 데이터를 불러오지 못했습니다. 관리자에게 문의해 주세요.",
  databaseInvalid:
    "데이터베이스 연결 설정을 확인해야 합니다. 관리자에게 문의해 주세요.",
  databaseConnection:
    "데이터베이스 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.",
  dataLoad:
    "데이터를 불러오지 못했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.",
} as const;

type ErrorCodeCarrier = {
  code?: unknown;
  message?: unknown;
};

function errorCodeFrom(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const code = (error as ErrorCodeCarrier).code;
  return typeof code === "string" ? code : "";
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== "object") return "";
  const message = (error as ErrorCodeCarrier).message;
  return typeof message === "string" ? message : "";
}

export function dataLoadErrorMessage(error: unknown): string {
  const code = errorCodeFrom(error);
  const message = errorMessageFrom(error);

  if (message.includes("DATABASE_URL is missing")) {
    return UI_ERROR_MESSAGES.databaseMissing;
  }

  if (message.includes("DATABASE_URL format is invalid")) {
    return UI_ERROR_MESSAGES.databaseInvalid;
  }

  if (
    code.startsWith("ECONN") ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "57P01" ||
    code === "53300"
  ) {
    return UI_ERROR_MESSAGES.databaseConnection;
  }

  return UI_ERROR_MESSAGES.dataLoad;
}
