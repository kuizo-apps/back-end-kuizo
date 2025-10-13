import Joi from "joi";

export const RoomCreateSchema = Joi.object({
  name: Joi.string().min(3).max(120).required(),
  question_count: Joi.number().integer().min(1).max(200).required(),
  assessment_mechanism: Joi.string()
    .valid(
      "static",
      "random",
      "adaptive_fixed_length",
      "adaptive_variable_length"
    )
    .required(),
});

export const RoomStatusSchema = Joi.object({
  status: Joi.string()
    .valid("persiapan", "mulai_ujian", "ujian_berakhir")
    .required(),
});

export const RoomJoinSchema = Joi.object({
  keypass: Joi.string().alphanum().length(8).required(),
});

export const RoomQuerySchema = Joi.object({
  q: Joi.string().allow("", null),
  status: Joi.string().valid("persiapan", "mulai_ujian", "ujian_berakhir"),
});
