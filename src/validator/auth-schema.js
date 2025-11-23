import Joi from "joi";

export const RegisterAdminSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  full_name: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
  nomer_induk: Joi.string().min(5).max(20).required(),
  password: Joi.string().min(6).required(),
});

export const RegisterUserSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  full_name: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
  nomer_induk: Joi.string().min(5).max(20).required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid("guru", "siswa").required(),
  class_student: Joi.string()
    .max(8)
    .when("role", {
      is: "siswa",
      then: Joi.required(), // Jika siswa, wajib diisi
      otherwise: Joi.optional().allow(null, ""), // Jika guru, boleh kosong
    }),
});

export const LoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});
