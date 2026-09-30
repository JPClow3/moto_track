/** Keep Cloudflare Rocket Loader from rewriting nonce-protected app scripts.
 * https://developers.cloudflare.com/speed/optimization/content/rocket-loader/ignore-javascripts/
 */
export function preserveAppScripts(html: string): string {
  return html.replace(
    /<script\b(?![^>]*\bdata-cfasync\s*=)/gi,
    '<script data-cfasync="false"',
  );
}
