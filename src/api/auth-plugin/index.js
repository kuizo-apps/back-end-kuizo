import routes from "./routes.js";
import AuthHandler from "./handler.js";

const auth = {
  name: "auth-plugin",
  version: "1.0.0",
  register: async (server, { service, tokenManager }) => {
    const authHandler = new AuthHandler(service, tokenManager);
    server.route(routes(authHandler));
  },
};

export default auth;
