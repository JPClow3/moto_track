async function load({ locals, url }) {
  return {
    user: locals.user,
    currentPath: url.pathname
  };
}
export {
  load
};
