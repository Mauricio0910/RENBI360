/*
 * REN-BI 360 - API publica temporaria via Cloudflare Quick Tunnel
 * ATENCAO: esta URL muda quando o Quick Tunnel for reiniciado.
 */
window.RENBI_PUBLIC_API_BASE = "https://finish-reel-generations-unlimited.trycloudflare.com";

(function () {
  const isHttp = /^https?:$/.test(window.location.protocol);
  const isGitHubPages = /\.github\.io$/i.test(window.location.hostname || "");

  if (isHttp && !isGitHubPages) {
    window.RENBI_API_BASE = window.location.origin;
  } else {
    window.RENBI_API_BASE =
      (window.RENBI_PUBLIC_API_BASE || "").replace(/\/$/, "");
  }
})();
