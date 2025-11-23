import * as AugmentSchema from "../../validator/augment-schema.js";

const routes = (handler) => [
  {
    method: "POST",
    path: "/augment/{questionId}",
    handler: handler.saveAugmentHandler,
    options: {
      auth: { strategy: "jwt", scope: ["guru", "admin"] },
      tags: ["api", "augment"],
      description: "Mengaugmentasi soal dan menyimpannya ke database (AI → DB)",
      validate: { payload: AugmentSchema.AugmentQuestionSchema },
    },
  },
];

export default routes;
