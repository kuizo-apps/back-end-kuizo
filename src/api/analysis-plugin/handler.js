export default class AnalysisHandler {
  constructor(service) {
    this._service = service;
    this.getDashboardHandler = this.getDashboardHandler.bind(this);
  }

  async getDashboardHandler(request, h) {
    const { id: teacher_id } = request.auth.credentials;

    const params = request.query;

    const result = await this._service.getTeacherDashboard(teacher_id, params);

    return {
      status: "success",
      message: "Data analisis soal berhasil dimuat",
      data: result,
    };
  }
}
