export const PASSWORD_MIN_LENGTH = 12;

export type PasswordRequirementId =
  | "length"
  | "lowercase"
  | "uppercase"
  | "number"
  | "symbol";

export type PasswordRequirementResult = {
  id: PasswordRequirementId;
  met: boolean;
};

export function getPasswordRequirementResults(
  password: string,
): PasswordRequirementResult[] {
  return [
    {
      id: "length",
      met: password.length >= PASSWORD_MIN_LENGTH,
    },
    {
      id: "lowercase",
      met: /[a-z]/.test(password),
    },
    {
      id: "uppercase",
      met: /[A-Z]/.test(password),
    },
    {
      id: "number",
      met: /\d/.test(password),
    },
    {
      id: "symbol",
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

export function isPasswordValid(password: string) {
  return getPasswordRequirementResults(password).every(
    (requirement) => requirement.met,
  );
}
