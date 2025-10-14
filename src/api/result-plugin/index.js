import routes from "./routes.js";
import ResultHandler from "./handler.js";

const result = {
  name: "result-plugin",
  version: "1.0.0",
  register: async (server, { service, tokenManager }) => {
    const resultHandler = new ResultHandler(service, tokenManager);
    server.route(routes(resultHandler));
  },
};

export default result;
