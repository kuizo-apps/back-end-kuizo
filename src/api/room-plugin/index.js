import routes from "./routes.js";
import RoomHandler from "./handler.js";

const room = {
  name: "room-plugin",
  version: "1.0.0",
  register: async (server, { service, tokenManager }) => {
    const roomHandler = new RoomHandler(service, tokenManager);
    server.route(routes(roomHandler));
  },
};

export default room;
