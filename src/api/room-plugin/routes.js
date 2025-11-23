import * as RoomSchemas from "../../validator/room-schema.js";

const routes = (handler) => [
  // ====== GURU/ADMIN ======
  {
    method: "POST",
    path: "/rooms",
    handler: handler.postCreateRoomHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "rooms"],
      description: "Membuat room baru",
      validate: { payload: RoomSchemas.RoomCreateSchema },
    },
  },
  {
    method: "GET",
    path: "/rooms",
    handler: handler.getMyRoomsHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "rooms"],
      description: "Daftar room milik pembuat",
      validate: { query: RoomSchemas.RoomQuerySchema },
    },
  },
  {
    method: "GET",
    path: "/rooms/{id}",
    handler: handler.getRoomDetailHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "rooms"],
      description: "Detail room + daftar peserta (hanya milik sendiri)",
    },
  },
  {
    method: "PATCH",
    path: "/rooms-status/{id}",
    handler: handler.patchRoomStatusHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "rooms"],
      description: "Ubah status room",
      validate: { payload: RoomSchemas.RoomStatusSchema },
    },
  },
  {
    method: "DELETE",
    path: "/rooms/{id}",
    handler: handler.deleteRoomHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "rooms"],
      description: "Hapus room (hanya milik sendiri)",
    },
  },
  {
    method: "DELETE",
    path: "/rooms/{id}/participants/{student_id}",
    handler: handler.deleteParticipantHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "rooms"],
      description: "Kick peserta dari room (hanya milik sendiri)",
    },
  },

  // ====== SISWA ======
  {
    method: "POST",
    path: "/rooms-join",
    handler: handler.postJoinRoomHandler,
    options: {
      auth: { strategy: "jwt", scope: ["siswa"] },
      tags: ["api", "rooms"],
      description: "Siswa join ke room via keypass (hanya saat persiapan)",
      validate: { payload: RoomSchemas.RoomJoinSchema },
    },
  },
  {
    method: "GET",
    path: "/rooms-participants/{room_id}",
    handler: handler.getRoomParticipantsForStudentHandler,
    options: {
      auth: { strategy: "jwt", scope: ["siswa"] },
      tags: ["api", "rooms"],
      description: "Lihat daftar peserta di room yang sama (siswa)",
    },
  },
  {
    method: "DELETE",
    path: "/rooms-leave/{room_id}",
    handler: handler.deleteLeaveRoomHandler,
    options: {
      auth: { strategy: "jwt", scope: ["siswa"] },
      tags: ["api", "rooms"],
      description: "Siswa keluar dari room",
    },
  },
  {
    method: "GET",
    path: "/my-rooms",
    handler: handler.getStudentRoomsHandler,
    options: {
      auth: { strategy: "jwt", scope: ["siswa"] },
      tags: ["api", "rooms"],
      description: "Daftar room yang diikuti siswa",
    },
  },
];

export default routes;
