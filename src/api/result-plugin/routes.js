const routes = (handler) => [
  {
    method: "GET",
    path: "/student-reports/{room_id}",
    handler: handler.getStudentReportHandler,
    options: {
      auth: { strategy: "jwt", scope: ["siswa", "guru", "admin"] },
      tags: ["api", "student-reports"],
      description: "Menampilkan laporan siswa",
    },
  },
];

export default routes;
