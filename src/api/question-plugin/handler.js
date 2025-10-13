export default class QuestionHandler {
  constructor(service) {
    this._service = service;

    this.getQuestionsHandler = this.getQuestionsHandler.bind(this);
    this.getQuestionByIdHandler = this.getQuestionByIdHandler.bind(this);
    this.postQuestionHandler = this.postQuestionHandler.bind(this);
    this.putQuestionHandler = this.putQuestionHandler.bind(this);
    this.deleteQuestionHandler = this.deleteQuestionHandler.bind(this);

    this.getTopicsHandler = this.getTopicsHandler.bind(this);
    this.postTopicHandler = this.postTopicHandler.bind(this);
    this.deleteTopicHandler = this.deleteTopicHandler.bind(this);
  }

  // ======= SOAL =======
  async getQuestionsHandler(request) {
    const result = await this._service.listQuestions(request.query);
    return { status: "success", data: result.data, meta: result.meta };
  }

  async getQuestionByIdHandler(request) {
    const { id } = request.params;
    const data = await this._service.getQuestionById(id);
    return { status: "success", data };
  }

  async postQuestionHandler(request, h) {
    const { image_file, ...payload } = request.payload;
    const data = await this._service.createQuestion({
      ...payload,
      image_file,
    });
    return h
      .response({
        status: "success",
        message: "Soal berhasil ditambahkan",
        data,
      })
      .code(201);
  }

  async putQuestionHandler(request) {
    const { id } = request.params;
    const { image_file, ...payload } = request.payload;
    const data = await this._service.updateQuestion(id, {
      ...payload,
      image_file,
    });
    return { status: "success", message: "Soal berhasil diperbarui", data };
  }

  async deleteQuestionHandler(request) {
    const { id } = request.params;
    await this._service.deleteQuestion(id);
    return { status: "success", message: "Soal berhasil dihapus" };
  }

  // ======= TOPIK =======
  async getTopicsHandler(request) {
    const result = await this._service.listTopics(request.query);
    return { status: "success", data: result.data, meta: result.meta };
  }

  async postTopicHandler(request, h) {
    const data = await this._service.createTopic(request.payload);
    return h
      .response({ status: "success", message: "Topik berhasil dibuat", data })
      .code(201);
  }

  async deleteTopicHandler(request) {
    const { id } = request.params;
    await this._service.deleteTopic(id);
    return { status: "success", message: "Topik berhasil dihapus" };
  }
}
