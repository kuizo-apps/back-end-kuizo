import routes from "./routes.js";
import ExamHandler from "./handler.js";

const exam = {
  name: "exam-plugin",
  version: "1.0.0",
  register: async (server, { service, tokenManager }) => {
    const examHandler = new ExamHandler(service, tokenManager);
    server.route(routes(examHandler));
  },
};

export default exam;
