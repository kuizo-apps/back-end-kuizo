export default class ResultHandler {
  constructor(service) {
    this._service = service;
    this.getStudentReportHandler = this.getStudentReportHandler.bind(this);
  }

  async getStudentReportHandler(request, h) {
    try {
      const { id: user_id, role } = request.auth.credentials;
      const { room_id } = request.params;

      const result = await this._service.getStudentReport(
        user_id,
        room_id,
        role
      );

      return h.response({
        status: "success",
        data: result,
      });
    } catch (error) {
      return h
        .response({
          status: "error",
          message: error.message || "Gagal mengambil laporan siswa",
        })
        .code(error.statusCode || 500);
    }
  }
}
