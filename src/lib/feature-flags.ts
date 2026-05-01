export function isOperatingUnitsEnabled(): boolean {
  return (
    process.env.OPERATING_UNITS_ENABLED === "1" ||
    process.env.OPERATING_UNITS_ENABLED === "true"
  );
}
