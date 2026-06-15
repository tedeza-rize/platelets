import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDataDirectoryPath } from "@/lib/data-paths";

const SECRET_FILE_NAME = ".platelets-secret-key";
const SECRET_BOX_VERSION = 1;

export type SecretBox = {
  ciphertext: string;
  iv: string;
  tag: string;
  type: "platelets-secret-box";
  version: typeof SECRET_BOX_VERSION;
};

export type ProtectedSecret = SecretBox | string;

function getSecretMaterial() {
  const dataDirectory = getDataDirectoryPath();
  const secretFilePath = path.join(dataDirectory, SECRET_FILE_NAME);

  fs.mkdirSync(dataDirectory, { recursive: true });

  if (fs.existsSync(secretFilePath)) {
    return fs.readFileSync(secretFilePath, "utf8").trim();
  }

  const generatedSecret = randomBytes(32).toString("base64url");
  fs.writeFileSync(secretFilePath, `${generatedSecret}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  return generatedSecret;
}

function getEncryptionKey() {
  return createHash("sha256").update(getSecretMaterial()).digest();
}

export function isSecretBox(value: unknown): value is SecretBox {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<SecretBox>).type === "platelets-secret-box" &&
    (value as Partial<SecretBox>).version === SECRET_BOX_VERSION &&
    typeof (value as Partial<SecretBox>).ciphertext === "string" &&
    typeof (value as Partial<SecretBox>).iv === "string" &&
    typeof (value as Partial<SecretBox>).tag === "string"
  );
}

export function protectSecret(value: string): ProtectedSecret {
  if (!value) {
    return "";
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    type: "platelets-secret-box",
    version: SECRET_BOX_VERSION,
  };
}

export function revealSecret(value: ProtectedSecret): string {
  if (!isSecretBox(value)) {
    return value;
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(value.iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(value.tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
