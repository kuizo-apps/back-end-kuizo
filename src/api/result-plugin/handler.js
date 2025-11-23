import InvariantError from "../../exceptions/InvariantError.js";
import NotFoundError from "../../exceptions/NotFoundError.js";

export default class ResultHandler {
  constructor(service) {
    this._service = service;

    this.getTeacherOverviewHandler = this.getTeacherOverviewHandler.bind(this);
    this.getTeacherQuestionAnalysisHandler =
      this.getTeacherQuestionAnalysisHandler.bind(this);
    this.getTeacherStudentListHandler =
      this.getTeacherStudentListHandler.bind(this);
    this.getStudentDetailHandler = this.getStudentDetailHandler.bind(this);
  }

  async getTeacherOverviewHandler(request, h) {
    const { room_id } = request.params;
    const result = await this._service.getTeacherOverview(room_id);
    return { status: "success", data: result };
  }

  async getTeacherQuestionAnalysisHandler(request, h) {
    const { room_id } = request.params;
    const result = await this._service.getTeacherQuestionAnalysis(room_id);
    return { status: "success", data: result };
  }

  async getTeacherStudentListHandler(request, h) {
    const { room_id } = request.params;
    const result = await this._service.getTeacherStudentList(room_id);
    return { status: "success", data: result };
  }

  async getStudentDetailHandler(request, h) {
    const { role, id: requester_id } = request.auth.credentials;
    const { room_id, student_id } = request.params;

    let targetStudentId = student_id;

    if (role === "siswa") {
      targetStudentId = requester_id;
    }

    if (!targetStudentId) {
      throw new InvariantError(
        "Parameter student_id diperlukan untuk role Guru/Admin"
      );
    }

    try {
      const result = await this._service.getStudentReport(
        targetStudentId,
        room_id
      );
      return { status: "success", data: result };
    } catch (error) {
      if (error instanceof NotFoundError) {
        return h.response({ status: "fail", message: error.message }).code(404);
      }
      throw error;
    }
  }
}
