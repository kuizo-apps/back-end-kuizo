import * as ExamSchemas from "../../validator/exam-schema.js";

const routes = (handler) => [
  {
    method: "POST",
    path: "/exam-start",
    handler: handler.startHandler,
    options: {
      auth: { strategy: "jwt", scope: ["siswa"] },
      tags: ["api", "exam"],
      description: "Mulai ujian pada room tertentu",
      validate: { payload: ExamSchemas.StartExamSchema },
    },
  },
  {
    method: "POST",
    path: "/exam-next",
    handler: handler.nextHandler,
    options: {
      auth: { strategy: "jwt", scope: ["siswa"] },
      tags: ["api", "exam"],
      description: "Kirim jawaban & ambil soal berikutnya",
      validate: { payload: ExamSchemas.NextQuestionSchema },
    },
  },
  {
    method: "POST",
    path: "/exam-question",
    handler: handler.getQuestionHandler,
    options: {
      auth: { strategy: "jwt", scope: ["siswa"] },
      tags: ["api", "exam"],
      description: "Ambil detail soal tertentu (untuk navigasi klik)",
      validate: { payload: ExamSchemas.GetSpecificQuestionSchema },
    },
  },
  {
    method: "POST",
    path: "/exam-finish",
    handler: handler.finishHandler,
    options: {
      auth: { strategy: "jwt", scope: ["siswa"] },
      tags: ["api", "exam"],
      description: "Selesaikan ujian & ambil skor",
      validate: { payload: ExamSchemas.FinishExamSchema },
    },
  },
  {
    method: "GET",
    path: "/exam-result/{room_id}",
    handler: handler.resultHandler,
    options: {
      auth: { strategy: "jwt", scope: ["siswa"] },
      tags: ["api", "exam"],
      description: "Lihat hasil ujian (siswa)",
    },
  },
];

export default routes;
