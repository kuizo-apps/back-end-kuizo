import * as AuthSchemas from "../../validator/auth-schema.js";

const routes = (handler) => [
  {
    method: "POST",
    path: "/register-admin",
    handler: handler.postRegisterAdminHandler,
    options: {
      auth: false,
      description: "Registrasi admin utama (hanya 1x)",
      tags: ["api", "auth"],
      validate: { payload: AuthSchemas.RegisterAdminSchema },
    },
  },
  {
    method: "POST",
    path: "/register-user",
    handler: handler.postRegisterUserHandler,
    options: {
      auth: {
        strategy: "jwt",
        scope: ["admin"], // hanya admin
      },
      description: "Membuat akun guru/siswa",
      tags: ["api", "auth"],
      validate: { payload: AuthSchemas.RegisterUserSchema },
    },
  },
  {
    method: "POST",
    path: "/login",
    handler: handler.postLoginHandler,
    options: {
      auth: false,
      description: "Login untuk semua pengguna (admin/guru/siswa)",
      tags: ["api", "auth"],
      validate: { payload: AuthSchemas.LoginSchema },
    },
  },
];

export default routes;
