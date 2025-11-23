import Joi from "joi";

export const AugmentQuestionSchema = Joi.object({
  target_level: Joi.string()
    .valid("C1", "C2", "C3", "C4", "C5", "C6")
    .required(),
});
