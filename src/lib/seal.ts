import sodium from "libsodium-wrappers";

/** Encrypts a value with a repository public key, the format GitHub's secrets API expects. */
export async function sealForGitHub(value: string, publicKeyBase64: string): Promise<string> {
  await sodium.ready;
  const key = sodium.from_base64(publicKeyBase64, sodium.base64_variants.ORIGINAL);
  const sealed = sodium.crypto_box_seal(sodium.from_string(value), key);
  return sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);
}
