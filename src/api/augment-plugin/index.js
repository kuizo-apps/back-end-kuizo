import routes from "./routes.js";
import AugmentHandler from "./handler.js";

const augment = {
  name: "augment-plugin",
  version: "1.0.0",
  register: async (server, { service, tokenManager }) => {
    const augmentHandler = new AugmentHandler(service, tokenManager);
    server.route(routes(augmentHandler));
  },
};

export default augment;
