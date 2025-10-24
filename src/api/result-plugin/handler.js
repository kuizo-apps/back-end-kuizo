export default class ResultHandler {
  constructor(service) {
    this._service = service;
    this.getStudentReportHandler = this.getStudentReportHandler.bind(this);
    this.getRoomSummaryHandler = this.getRoomSummaryHandler.bind(this);
    this.getStudentDetailHandler = this.getStudentDetailHandler.bind(this);
  }

  /** === Untuk siswa melihat hasil ujian sendiri === */
  async getStudentReportHandler(request, h) {
    try {
      const { id: user_id } = request.auth.credentials;
      const { room_id } = request.params;

      const result = await this._service.getStudentReport(user_id, room_id);

      return h.response({ status: "success", data: result });
    } catch (error) {
      return h
        .response({
          status: "error",
          message: error.message || "Gagal mengambil laporan siswa",
        })
        .code(error.statusCode || 500);
    }
  }

  /** === Untuk guru: melihat rekap seluruh siswa dalam room === */
  async getRoomSummaryHandler(request, h) {
    try {
      const { role } = request.auth.credentials;
      const { room_id } = request.params;

      if (role !== "guru" && role !== "admin") {
        return h
          .response({
            status: "fail",
            message: "Hanya guru atau admin yang dapat mengakses data ini.",
          })
          .code(403);
      }

      const result = await this._service.getRoomSummaryForTeacher(room_id);
      return h.response({ status: "success", data: result });
    } catch (error) {
      return h
        .response({
          status: "error",
          message: error.message || "Gagal mengambil rekap room",
        })
        .code(error.statusCode || 500);
    }
  }

  /** === Untuk guru: melihat detail satu siswa dalam room === */
  async getStudentDetailHandler(request, h) {
    try {
      const { role } = request.auth.credentials;
      const { room_id, student_id } = request.params;

      if (role !== "guru" && role !== "admin") {
        return h
          .response({
            status: "fail",
            message: "Hanya guru atau admin yang dapat mengakses data ini.",
          })
          .code(403);
      }

      const result = await this._service.getStudentDetailForTeacher(
        student_id,
        room_id
      );
      return h.response({ status: "success", data: result });
    } catch (error) {
      return h
        .response({
          status: "error",
          message: error.message || "Gagal mengambil detail siswa",
        })
        .code(error.statusCode || 500);
    }
  }
}
