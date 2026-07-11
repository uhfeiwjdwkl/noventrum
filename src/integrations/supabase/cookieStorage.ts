const ROOT_DOMAIN = "kommenszlapf.website";
const useCookies = () =>
  typeof window !== "undefined" && window.location.hostname.endsWith(ROOT_DOMAIN);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()\[\]\\/+^]/g, "\\$&") + "=([^;]*)"),
  );
  return m ? decodeURIComponent(m[1]) : null;
}
function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie =
    `${name}=${encodeURIComponent(value)}; Domain=.${ROOT_DOMAIN};` +
    ` Path=/; Max-Age=31536000; Secure; SameSite=Lax`;
}
function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Domain=.${ROOT_DOMAIN}; Path=/; Max-Age=0; Secure; SameSite=Lax`;
}

export const cookieStorage = {
  getItem: (k: string) => {
    if (typeof window === "undefined") return null;
    return useCookies() ? readCookie(k) : window.localStorage.getItem(k);
  },
  setItem: (k: string, v: string) => {
    if (typeof window === "undefined") return;
    useCookies() ? writeCookie(k, v) : window.localStorage.setItem(k, v);
  },
  removeItem: (k: string) => {
    if (typeof window === "undefined") return;
    useCookies() ? deleteCookie(k) : window.localStorage.removeItem(k);
  },
};
