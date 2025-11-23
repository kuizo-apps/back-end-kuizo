export default class AugmentHandler {
  constructor(service) {
    this._service = service;

    this.previewAugmentHandler = this.previewAugmentHandler.bind(this);
    this.saveAugmentHandler = this.saveAugmentHandler.bind(this);
  }

  // === Endpoint 1: Preview hasil AI
  async previewAugmentHandler(request, h) {
    const { questionId } = request.params;
    const { target_level } = request.payload;

    const result = await this._service.previewAugment(questionId, target_level);

    return h
      .response({
        status: "success",
        message: "Preview hasil augmentasi berhasil dihasilkan",
        data: result,
      })
      .code(200);
  }

  // === Endpoint 2: Generate + Simpan ke DB
  async saveAugmentHandler(request, h) {
    const { questionId } = request.params;
    const { target_level } = request.payload;
    const { id: userId } = request.auth.credentials;

    const result = await this._service.saveAugment(
      questionId,
      target_level,
      userId
    );

    return h
      .response({
        status: "success",
        message: "Soal augmentasi berhasil disimpan ke database",
        data: result,
      })
      .code(201);
  }
}
