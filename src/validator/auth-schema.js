import Joi from "joi";

export const RegisterAdminSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  full_name: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
  nomer_induk: Joi.string().min(5).max(20).required(),
  password: Joi.string().min(6).required(),
});

export const RegisterUserSchema = Joi.object({
  username: Joi.string().required(),
  full_name: Joi.string().required(),
  email: Joi.string().email().required(),
  nomer_induk: Joi.string().required(),
  password: Joi.string().required(),
  role: Joi.string().valid("guru", "siswa").required(),
  class_student: Joi.string().allow(null, ""),
}).unknown(true);

export const LoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});
