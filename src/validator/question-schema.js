import Joi from "joi";

// === Soal ===
export const QuestionCreateSchema = Joi.object({
  topic_id: Joi.number().integer().allow(null),
  topic_name: Joi.string().allow(null, ""),
  question_text: Joi.string().required(),
  image_url: Joi.string().uri().allow(null, ""),
  image_file: Joi.any()
    .meta({ swaggerType: "file" })
    .description("Gambar soal"),
  option_a: Joi.string().required(),
  option_b: Joi.string().required(),
  option_c: Joi.string().required(),
  option_d: Joi.string().required(),
  option_e: Joi.string().required(),
  correct_answer: Joi.string().valid("A", "B", "C", "D", "E").required(),
  version: Joi.string().valid("original", "augmentasi").default("original"),
  parent_question_id: Joi.number().allow(null),
});

export const QuestionUpdateSchema = Joi.object({
  topic_id: Joi.number().integer(),
  topic_name: Joi.string().allow(null, ""),
  question_text: Joi.string(),
  image_url: Joi.string().uri().allow(null, ""),
  option_a: Joi.string(),
  option_b: Joi.string(),
  option_c: Joi.string(),
  option_d: Joi.string(),
  option_e: Joi.string(),
  correct_answer: Joi.string().valid("A", "B", "C", "D", "E"),
  difficulty_level: Joi.number().integer().min(1).max(3),
  discrimination_index: Joi.number(),
  parent_question_id: Joi.number().allow(null),
});

export const QuestionQuerySchema = Joi.object({
  q: Joi.string().allow("", null),
  topic_id: Joi.number().integer(),
  difficulty_level: Joi.number().integer().min(1).max(3),
  version: Joi.string().valid("original", "augmentasi"),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string()
    .pattern(/^[a-zA-Z_]+.(asc|desc)$/)
    .default("created_at.desc"),
});

// === Topik ===
export const TopicCreateSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
});

export const TopicQuerySchema = Joi.object({
  q: Joi.string().allow("", null),
  page: Joi.number().integer().min(1).default(1),
});
