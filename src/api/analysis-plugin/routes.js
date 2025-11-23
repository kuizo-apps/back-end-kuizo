import * as AnalysisSchema from "../../validator/analysis-schema.js";

const routes = (handler) => [
  {
    method: "GET",
    path: "/analysis-questions",
    handler: handler.getDashboardHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] }, // Hanya guru/admin
      tags: ["api", "analysis"],
      description: "Mendapatkan dashboard analisis performa soal milik guru",
      validate: { query: AnalysisSchema.AnalysisQuerySchema },
    },
  },
];

export default routes;
