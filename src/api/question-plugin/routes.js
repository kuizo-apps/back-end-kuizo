import * as QuestionSchemas from "../../validator/question-schema.js";
import Joi from "joi";

const routes = (handler) => [
  // ======= TOPIK =======
  {
    method: "GET",
    path: "/topics",
    handler: handler.getTopicsHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin", "siswa"] },
      tags: ["api", "topics"],
      description: "Menampilkan daftar topik berdasarkan level kelas",
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
      description: "Menambahkan topik baru dengan level kelas",
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
  {
    method: "GET",
    path: "/topics/learning-objectives/{id}",
    handler: handler.getLearningObjectivesByTopicHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin", "siswa"] },
      tags: ["api", "topics"],
      description: "Menampilkan daftar tujuan pembelajaran berdasarkan topik",
      validate: {
        params: Joi.object({
          id: Joi.number().integer().required(),
        }),
      },
    },
  },

  // ======= SOAL =======
  {
    method: "GET",
    path: "/questions",
    handler: handler.getQuestionsHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin", "siswa"] },
      tags: ["api", "questions"],
      description: "Menampilkan daftar soal (bisa filter level, topik, status)",
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
        "Menambahkan soal baru (dengan gambar, level kognitif, dan topik otomatis)",
      payload: {
        maxBytes: 5 * 1024 * 1024,
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
      description:
        "Memperbarui soal (ubah teks, gambar, topik, level kognitif, dsb)",
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
    method: "PATCH",
    path: "/questions-verify/{id}",
    handler: handler.patchQuestionVerificationHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "questions"],
      description: "Memperbarui status verifikasi dan catatan soal",
      validate: {
        payload: {
          verification_status: QuestionSchemas.QuestionUpdateSchema.extract(
            "verification_status"
          ),
          notes: QuestionSchemas.QuestionUpdateSchema.extract("notes"),
        },
      },
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
