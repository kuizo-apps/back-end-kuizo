export default class RoomHandler {
  constructor(service) {
    this._service = service;

    // guru/admin
    this.postCreateRoomHandler = this.postCreateRoomHandler.bind(this);
    this.generateStaticQuestionsHandler = this.generateStaticQuestionsHandler.bind(this);
    this.getMyRoomsHandler = this.getMyRoomsHandler.bind(this);
    this.getRoomDetailHandler = this.getRoomDetailHandler.bind(this);
    this.patchRoomStatusHandler = this.patchRoomStatusHandler.bind(this);
    this.deleteRoomHandler = this.deleteRoomHandler.bind(this);
    this.deleteParticipantHandler = this.deleteParticipantHandler.bind(this);

    // siswa
    this.postJoinRoomHandler = this.postJoinRoomHandler.bind(this);
    this.deleteLeaveRoomHandler = this.deleteLeaveRoomHandler.bind(this);
    this.getStudentRoomsHandler = this.getStudentRoomsHandler.bind(this);
  }

  /* ====== GURU/ADMIN ====== */
  async postCreateRoomHandler(request, h) {
    const { id: creatorId } = request.auth.credentials;
    const room = await this._service.createRoom(request.payload, creatorId);
    return h
      .response({
        status: "success",
        message: "Room berhasil dibuat",
        data: room,
      })
      .code(201);
  }

  async generateStaticQuestionsHandler(request, h) {
    const { id: creatorId } = request.auth.credentials;
    const { id: roomId } = request.params;
    const result = await this._service.generateStaticQuestions(
      roomId,
      creatorId
    );
    return h
      .response({
        status: "success",
        message: `Berhasil membuat set soal static (${result.total_inserted} soal)`,
        data: result,
      })
      .code(201);
  }

  async getMyRoomsHandler(request) {
    const { id: creatorId } = request.auth.credentials;
    const result = await this._service.listRoomsByCreator(
      creatorId,
      request.query
    );
    return { status: "success", data: result.data, meta: result.meta };
  }

  async getRoomDetailHandler(request) {
    const { id: creatorId } = request.auth.credentials;
    const { id } = request.params;
    const data = await this._service.getRoomDetail(id, creatorId);
    return { status: "success", data };
  }

  async patchRoomStatusHandler(request) {
    const { id: creatorId } = request.auth.credentials;
    const { id } = request.params;
    const data = await this._service.updateRoomStatus(
      id,
      request.payload.status,
      creatorId
    );
    return { status: "success", message: "Status room diperbarui", data };
  }

  async deleteRoomHandler(request) {
    const { id: creatorId } = request.auth.credentials;
    const { id } = request.params;
    await this._service.deleteRoom(id, creatorId);
    return { status: "success", message: "Room berhasil dihapus" };
  }

  async deleteParticipantHandler(request) {
    const { id: creatorId } = request.auth.credentials;
    const { id: roomId, student_id } = request.params;
    await this._service.removeParticipant(roomId, student_id, creatorId);
    return { status: "success", message: "Peserta berhasil dihapus dari room" };
  }

  /* ====== SISWA ====== */
  async postJoinRoomHandler(request, h) {
    const { id: studentId } = request.auth.credentials;
    const { keypass } = request.payload;
    const data = await this._service.joinRoomByKeypass(studentId, keypass);
    return h
      .response({
        status: "success",
        message: "Berhasil bergabung ke room",
        data,
      })
      .code(201);
  }

  async deleteLeaveRoomHandler(request) {
    const { id: studentId } = request.auth.credentials;
    const { room_id } = request.params;
    await this._service.leaveRoom(room_id, studentId);
    return { status: "success", message: "Berhasil keluar dari room" };
  }

  async getStudentRoomsHandler(request) {
    const { id: studentId } = request.auth.credentials;
    const data = await this._service.listMyRooms(studentId);
    return { status: "success", data };
  }
}
