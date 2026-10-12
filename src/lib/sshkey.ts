import { createHash } from "node:crypto";

const OPENSSH_BEGIN = "-----BEGIN OPENSSH PRIVATE KEY-----";
const OPENSSH_END = "-----END OPENSSH PRIVATE KEY-----";
const MAGIC = "openssh-key-v1\0";

/**
 * Checks a pasted OpenSSH private key before it goes to GitHub, where it can
 * no longer be read back. Returns the key's SHA256 fingerprint, the same one
 * GitHub shows under Deploy keys, or throws a message for the form.
 */
export function sshKeyFingerprint(text: string): string {
  if (/^(ssh-|ecdsa-|sk-)/.test(text)) {
    throw new Error("Đây là public key (dòng ssh-…). Cần dán private key: cả khối BEGIN … END.");
  }
  if (!text.startsWith(OPENSSH_BEGIN) || !text.endsWith(OPENSSH_END)) {
    throw new Error(`Key phải bắt đầu bằng ${OPENSSH_BEGIN} và kết thúc bằng ${OPENSSH_END}.`);
  }

  const body = text.slice(OPENSSH_BEGIN.length, -OPENSSH_END.length).replace(/\s+/g, "");
  const data = Buffer.from(body, "base64");
  if (data.subarray(0, MAGIC.length).toString("latin1") !== MAGIC) {
    throw new Error("Nội dung key bị hỏng hoặc thiếu một đoạn (không đọc được).");
  }

  let offset = MAGIC.length;
  const readString = (): Buffer => {
    if (offset + 4 > data.length) throw new Error("Nội dung key bị cắt cụt.");
    const length = data.readUInt32BE(offset);
    offset += 4;
    if (offset + length > data.length) throw new Error("Nội dung key bị cắt cụt.");
    const value = data.subarray(offset, offset + length);
    offset += length;
    return value;
  };

  const cipher = readString().toString();
  readString(); // kdf name
  readString(); // kdf options
  if (cipher !== "none") {
    throw new Error("Key có passphrase; CI không nhập được passphrase. Dùng key không đặt passphrase.");
  }
  if (offset + 4 > data.length || data.readUInt32BE(offset) !== 1) {
    throw new Error("File phải chứa đúng một key.");
  }
  offset += 4;

  const publicKey = readString();
  // The private half follows; a cut-off paste fails here even though the
  // public half (and so the fingerprint) at the start is intact.
  const privateBlock = readString();
  if (privateBlock.length < 8 || privateBlock.readUInt32BE(0) !== privateBlock.readUInt32BE(4)) {
    throw new Error("Phần private của key bị hỏng.");
  }
  return `SHA256:${createHash("sha256").update(publicKey).digest("base64").replace(/=+$/, "")}`;
}
