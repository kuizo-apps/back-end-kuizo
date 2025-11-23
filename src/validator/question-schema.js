import Joi from "joi";

export const QuestionCreateSchema = Joi.object({
  subject_id: Joi.number().integer().allow(null),
  topic_id: Joi.number().integer().allow(null),
  topic_name: Joi.string().allow(null, ""),
  class_level: Joi.number().integer().min(10).max(12).default(11),
  learning_objective_id: Joi.number().integer().allow(null),
  learning_objective_text: Joi.string().allow(null, ""),
  question_text: Joi.string().required(),
  image_url: Joi.string().uri().allow(null, ""),
  image_file: Joi.any().meta({ swaggerType: "file" }),
  image_caption: Joi.string().allow(null, ""),
  option_a: Joi.string().required(),
  option_b: Joi.string().required(),
  option_c: Joi.string().required(),
  option_d: Joi.string().required(),
  option_e: Joi.string().required(),
  correct_answer: Joi.string().valid("A", "B", "C", "D", "E").required(),
  version: Joi.string().valid("original", "augmentasi").default("original"),
  parent_question_id: Joi.number().allow(null),
  difficulty_level: Joi.number().integer().min(1).max(3).default(2),
  cognitive_level: Joi.string()
    .valid("C1", "C2", "C3", "C4", "C5", "C6")
    .required(),

  created_by: Joi.string().uuid().allow(null),
  a_irt: Joi.number().precision(3).allow(null),
  b_irt: Joi.number().precision(3).allow(null),
});

export const QuestionUpdateSchema = Joi.object({
  subject_id: Joi.number().integer(),
  topic_id: Joi.number().integer(),
  topic_name: Joi.string().allow(null, ""),
  class_level: Joi.number().integer().min(10).max(12),
  learning_objective_id: Joi.number().integer().allow(null),
  learning_objective_text: Joi.string().allow(null, ""),

  question_text: Joi.string(),
  image_url: Joi.string().uri().allow(null, ""),
  image_caption: Joi.string().allow(null, ""),

  option_a: Joi.string(),
  option_b: Joi.string(),
  option_c: Joi.string(),
  option_d: Joi.string(),
  option_e: Joi.string(),
  correct_answer: Joi.string().valid("A", "B", "C", "D", "E"),
  difficulty_level: Joi.number().integer().min(1).max(3),
  discrimination_index: Joi.number(),
  cognitive_level: Joi.string().valid("C1", "C2", "C3", "C4", "C5", "C6"),
  verification_status: Joi.string().valid("belum valid", "valid", "revisi"),
  notes: Joi.string().allow("", null),
  a_irt: Joi.number().precision(3).allow(null),
  b_irt: Joi.number().precision(3).allow(null),
  parent_question_id: Joi.number().allow(null),
});

export const TopicQuerySchema = Joi.object({
  q: Joi.string().allow("", null),
  subject_id: Joi.number().integer().required(),
  class_level: Joi.number().integer().min(10).max(12),
  page: Joi.number().integer().min(1).default(1),
});

export const LearningObjectiveQuerySchema = Joi.object({
  topic_id: Joi.number().integer().required(),
});