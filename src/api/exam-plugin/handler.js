export default class ExamHandler {
  constructor(service) {
    this._service = service;

    this.startHandler = this.startHandler.bind(this);
    this.nextHandler = this.nextHandler.bind(this);
    this.finishHandler = this.finishHandler.bind(this);
    this.resultHandler = this.resultHandler.bind(this);
  }

  async startHandler(request) {
    const { id: student_id } = request.auth.credentials;
    const data = await this._service.startExam(student_id, request.payload);
    return { status: "success", data };
  }

  async nextHandler(request) {
    const { id: student_id } = request.auth.credentials;
    const data = await this._service.answerAndNext(student_id, request.payload);
    return { status: "success", data };
  }

  async finishHandler(request) {
    const { id: student_id } = request.auth.credentials;
    const data = await this._service.finish(student_id, request.payload);
    return { status: "success", data };
  }

  async resultHandler(request) {
    const { id: student_id, role } = request.auth.credentials;
    const data = await this._service.result(
      student_id,
      Number(request.params.room_id)
    );
    return { status: "success", data };
  }
}
