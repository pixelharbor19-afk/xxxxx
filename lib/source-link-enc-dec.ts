import CryptoJS from "crypto-js";

const KEY = process.env.NEXT_PUBLIC_LINK_KEY!;

export function encryptLink(link: string) {
  return CryptoJS.AES.encrypt(link, KEY).toString();
}

export function decryptLink(encrypted: string) {
  return CryptoJS.AES.decrypt(encrypted, KEY).toString(CryptoJS.enc.Utf8);
}
