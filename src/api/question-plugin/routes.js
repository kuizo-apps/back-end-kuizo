import * as QuestionSchemas from "../../validator/question-schema.js";

const routes = (handler) => [
  // ======= TOPIK =======
  {
    method: "GET",
    path: "/topics",
    handler: handler.getTopicsHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "topics"],
      description: "Menampilkan daftar topik",
      validate: { query: QuestionSchemas.TopicQuerySchema },
    },
  },
  {
    method: "POST",
    path: "/topics",
    handler: handler.postTopicHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "topics"],
      description: "Menambahkan topik baru",
      validate: { payload: QuestionSchemas.TopicCreateSchema },
    },
  },
  {
    method: "DELETE",
    path: "/topics/{id}",
    handler: handler.deleteTopicHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "topics"],
      description: "Menghapus topik",
    },
  },

  // ======= SOAL =======
  {
    method: "GET",
    path: "/questions",
    handler: handler.getQuestionsHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "questions"],
      description: "Menampilkan daftar soal",
      validate: { query: QuestionSchemas.QuestionQuerySchema },
    },
  },
  {
    method: "GET",
    path: "/questions/{id}",
    handler: handler.getQuestionByIdHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin", "siswa"] },
      tags: ["api", "questions"],
      description: "Menampilkan detail soal berdasarkan ID",
    },
  },
  {
    method: "POST",
    path: "/questions",
    handler: handler.postQuestionHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "questions"],
      description:
        "Menambahkan soal baru (bisa upload gambar & topik otomatis)",
      payload: {
        maxBytes: 5 * 1024 * 1024, // 5MB
        output: "stream",
        parse: true,
        multipart: true,
        allow: "multipart/form-data",
      },
      validate: { payload: QuestionSchemas.QuestionCreateSchema },
    },
  },
  {
    method: "PUT",
    path: "/questions/{id}",
    handler: handler.putQuestionHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "questions"],
      description: "Memperbarui soal (bisa ganti gambar & ubah topik)",
      payload: {
        maxBytes: 5 * 1024 * 1024,
        output: "stream",
        parse: true,
        multipart: true,
        allow: "multipart/form-data",
      },
      validate: { payload: QuestionSchemas.QuestionUpdateSchema },
    },
  },
  {
    method: "DELETE",
    path: "/questions/{id}",
    handler: handler.deleteQuestionHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "questions"],
      description: "Menghapus soal",
    },
  },
];

export default routes;
