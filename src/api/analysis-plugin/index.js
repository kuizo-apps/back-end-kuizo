import routes from "./routes.js";
import AnalysisHandler from "./handler.js";

const analysis = {
  name: "analysis-plugin",
  version: "1.0.0",
  register: async (server, { service, tokenManager }) => {
    const analysisHandler = new AnalysisHandler(service, tokenManager);
    server.route(routes(analysisHandler));
  },
};

export default analysis;
