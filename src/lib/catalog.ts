/** How a secret's value is entered on the form. */
export type SecretKind = "text" | "password" | "multiline" | "file-base64" | "json";

export type SecretSpec = {
  name: string;
  label: string;
  kind: SecretKind;
  /** True when every app normally carries the same value. */
  shared: boolean;
  help: string;
};

/** The secrets the shared ci-templates workflows read. */
export const SECRETS: SecretSpec[] = [
  {
    name: "PUB_GIT_SSH_KEY",
    label: "SSH key cho package git private",
    kind: "multiline",
    shared: true,
    help: "Khoá private của deploy key (vd. cho net_kit). Dán cả dòng BEGIN và END.",
  },
  {
    name: "APP_CONFIG_FILES",
    label: "File cấu hình (lib/config)",
    kind: "multiline",
    shared: false,
    help: "File cấu hình ngoài git, dạng base64 của tar.gz. Tạo ở thư mục gốc của app: tar czf - lib/config | base64 | tr -d '\\n' | pbcopy",
  },
  {
    name: "ANDROID_KEYSTORE_BASE64",
    label: "Keystore (.jks)",
    kind: "file-base64",
    shared: false,
    help: "Chọn file .jks; web tự mã hoá base64 trước khi gửi.",
  },
  {
    name: "ANDROID_KEYSTORE_PASSWORD",
    label: "Mật khẩu keystore",
    kind: "password",
    shared: false,
    help: "storePassword trong key.properties.",
  },
  {
    name: "ANDROID_KEY_ALIAS",
    label: "Key alias",
    kind: "text",
    shared: false,
    help: "keyAlias trong key.properties.",
  },
  {
    name: "ANDROID_KEY_PASSWORD",
    label: "Mật khẩu key",
    kind: "password",
    shared: false,
    help: "keyPassword trong key.properties.",
  },
  {
    name: "PLAY_SERVICE_ACCOUNT_JSON",
    label: "Service account Google Play",
    kind: "json",
    shared: true,
    help: "Toàn bộ file JSON của service account có quyền phát hành.",
  },
];

/** The four secrets filled together from a keystore and its key.properties. */
export const KEYSTORE_SECRETS = [
  "ANDROID_KEYSTORE_BASE64",
  "ANDROID_KEYSTORE_PASSWORD",
  "ANDROID_KEY_ALIAS",
  "ANDROID_KEY_PASSWORD",
] as const;

export function findSecret(name: string): SecretSpec | undefined {
  return SECRETS.find((s) => s.name === name);
}
