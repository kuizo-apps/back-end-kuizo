export default class AuthHandler {
  constructor(service, tokenManager) {
    this._service = service;
    this._tokenManager = tokenManager;

    this.postRegisterAdminHandler = this.postRegisterAdminHandler.bind(this);
    this.postRegisterUserHandler = this.postRegisterUserHandler.bind(this);
    this.postLoginHandler = this.postLoginHandler.bind(this);
  }

  // register admin
  async postRegisterAdminHandler(request, h) {
    const user = await this._service.registerAdmin(request.payload);
    return h
      .response({
        status: "success",
        message: "Admin berhasil terdaftar",
        data: user,
      })
      .code(201);
  }

  async postRegisterUserHandler(request, h) {
    const user = await this._service.registerUser(request.payload);
    return h
      .response({
        status: "success",
        message: `Akun ${user.role} berhasil terdaftar`,
        data: user,
      })
      .code(201);
  }

  async postLoginHandler(request, h) {
    const { user, profile } = await this._service.login(request.payload);
    const accessToken = this._tokenManager.createAccessToken({
      id: user.id,
      email: user.email,
      role: profile.role,
      username: profile.username,
    });

    return {
      status: "success",
      message: "Login berhasil",
      data: {
        accessToken,
        role: profile.role,
        name: profile.full_name,
      },
    };
  }
}
