function GET() {
  return new Response(
    `self.addEventListener('install',event=>self.skipWaiting());self.addEventListener('fetch',event=>{});`,
    { headers: { "content-type": "application/javascript" } }
  );
}
export {
  GET
};
