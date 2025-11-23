import Joi from "joi";

export const StartExamSchema = Joi.object({
  room_id: Joi.number().integer().required(),
});

export const NextQuestionSchema = Joi.object({
  room_id: Joi.number().integer().required(),
  question_id: Joi.number().integer().required(),
  answer: Joi.string().valid("A", "B", "C", "D", "E", "", null).allow(null, ""),
  time_taken_seconds: Joi.number().integer().min(0).required(),
});

export const FinishExamSchema = Joi.object({
  room_id: Joi.number().integer().required(),
});

export const GetSpecificQuestionSchema = Joi.object({
  room_id: Joi.number().integer().required(),
  question_id: Joi.number().integer().required(),
});