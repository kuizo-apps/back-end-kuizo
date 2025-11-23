import Joi from "joi";

export const AnalysisQuerySchema = Joi.object({
  q: Joi.string().allow("", null),
  subject_id: Joi.number().integer(),
  topic_id: Joi.number().integer(),
  class_level: Joi.number().integer().min(10).max(12),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).default(10),
  sort: Joi.string().default("created_at.desc"),
});
