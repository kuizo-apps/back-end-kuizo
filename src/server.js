"use strict";

import Hapi from "@hapi/hapi";
import dotenv from "dotenv";
import HapiAuthJwt2 from "hapi-auth-jwt2";
import TokenManager from "./tokenize/TokenManager.js";
import ClientError from "./exceptions/ClientError.js";

// import service plugins

// auth
import auth from "./api/auth-plugin/index.js";
import AuthService from "./services/supabase/AuthService.js";

// question
import question from "./api/question-plugin/index.js";
import QuestionService from "./services/supabase/QuestionService.js";

// room
import room from "./api/room-plugin/index.js";
import RoomService from "./services/supabase/RoomService.js";

// exam
import exam from "./api/exam-plugin/index.js";
import ExamService from "./services/supabase/ExamService.js";

// result
import result from "./api/result-plugin/index.js";
import ResultService from "./services/supabase/ResultService.js";

dotenv.config();

export const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 3000,
    host: "localhost",
    routes: {
      cors: {
        origin: ["*"],
      },
    },
  });

  // inisiasi service plugins
  const authService = new AuthService();
  const questionService = new QuestionService();
  const roomService = new RoomService();
  const examService = new ExamService();
  const resultService = new ResultService();

  await server.register(HapiAuthJwt2);

  server.auth.strategy("jwt", "jwt", {
    key: process.env.JWT_SECRET,
    validate: async (decoded, request, h) => {
      try {
        const user = await authService._getProfile(decoded.id);

        if (!user) {
          return { isValid: false };
        }

        return {
          isValid: true,
          credentials: { ...decoded, scope: decoded.role },
        };
      } catch (error) {
        return { isValid: false };
      }
    },
  });

  // register service plugins

  // auth
  await server.register({
    plugin: auth,
    options: {
      service: authService,
      tokenManager: TokenManager,
    },
  });

  // question
  await server.register({
    plugin: question,
    options: {
      service: questionService,
      tokenManager: TokenManager,
    },
  });

  // room
  await server.register({
    plugin: room,
    options: {
      service: roomService,
      tokenManager: TokenManager,
    },
  });

  // exam
  await server.register({
    plugin: exam,
    options: {
      service: examService,
      tokenManager: TokenManager,
    },
  });

  // result
  await server.register({
    plugin: result,
    options: {
      service: resultService,
      tokenManager: TokenManager,
    },
  });

  server.ext("onPreResponse", (request, h) => {
    const response = request.response;

    if (response instanceof Error) {
      if (response instanceof ClientError) {
        return h
          .response({
            status: "fail",
            message: response.message,
          })
          .code(response.statusCode);
      }

      if (response.isBoom) {
        return h
          .response({
            status: "error",
            message: response.output.payload.message || "terjadi kegagalan",
          })
          .code(response.output.statusCode);
      }

      return h
        .response({
          status: "error",
          message: "terjadi kegagalan pada server kami",
        })
        .code(500);
    }
    return h.continue;
  });

  await server.start();
  console.log(`Server berjalan di ${server.info.uri}`);
};

if (process.env.NODE_ENV !== "test") {
  init();
}
