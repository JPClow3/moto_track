const defaultRedirect = "/dashboard";
function safeInternalRedirect(redirectTo, fallback = defaultRedirect) {
  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//") || redirectTo.startsWith("/\\")) {
    return fallback;
  }
  return redirectTo;
}
export {
  safeInternalRedirect as s
};
