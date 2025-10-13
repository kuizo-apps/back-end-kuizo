import routes from "./routes.js";
import QuestionHandler from "./handler.js";

const question = {
  name: "question-plugin",
  version: "1.0.0",
  register: async (server, { service, tokenManager }) => {
    const questionHandler = new QuestionHandler(service, tokenManager);
    server.route(routes(questionHandler));
  },
};

export default question;
