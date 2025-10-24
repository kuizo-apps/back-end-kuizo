const routes = (handler) => [
  {
    method: "GET",
    path: "/student-reports/{room_id}",
    handler: handler.getStudentReportHandler,
    options: {
      auth: { strategy: "jwt", scope: ["siswa"] },
      tags: ["api", "student-reports"],
      description: "Menampilkan laporan hasil ujian untuk siswa (individu)",
    },
  },
  {
    method: "GET",
    path: "/teacher-reports/{room_id}",
    handler: handler.getRoomSummaryHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "teacher-reports"],
      description:
        "Menampilkan rekap performa seluruh siswa dalam room (guru/admin)",
    },
  },
  {
    method: "GET",
    path: "/teacher-reports/{room_id}/{student_id}",
    handler: handler.getStudentDetailHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "teacher-reports"],
      description:
        "Menampilkan detail performa satu siswa dalam room (guru/admin)",
    },
  },
];

export default routes;
