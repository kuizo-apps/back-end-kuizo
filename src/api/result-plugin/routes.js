const routes = (handler) => [
  {
    method: "GET",
    path: "/report-overview/{room_id}",
    handler: handler.getTeacherOverviewHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "report"],
      description: "Tab 1: Overview Class Performance, Top 3, Cog Analysis",
    },
  },

  {
    method: "GET",
    path: "/report-questions/{room_id}",
    handler: handler.getTeacherQuestionAnalysisHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "report"],
      description: "Tab 2: List Analisis Semua Soal di Room",
    },
  },

  {
    method: "GET",
    path: "/report-students/{room_id}",
    handler: handler.getTeacherStudentListHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "report"],
      description: "Tab 3: List Semua Siswa (Abjad)",
    },
  },

  {
    method: "GET",
    path: "/report-detail/{room_id}/{student_id?}",
    handler: handler.getStudentDetailHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin", "siswa"] },
      tags: ["api", "report"],
      description: "Detail report satu siswa lengkap dengan history soal",
    },
  },
];

export default routes;
