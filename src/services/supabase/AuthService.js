import { createClient } from "@supabase/supabase-js";
import InvariantError from "../../exceptions/InvariantError.js";
import AuthenticationError from "../../exceptions/AuthenticationError.js";

export default class AuthService {
  constructor() {
    this._supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    this._supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }

  // === Get Profile by ID ===
  async _getProfile(userId) {
    const { data: profile, error } = await this._supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw new InvariantError("Gagal mengambil profil user.");
    }

    return profile;
  }

  // === Registrasi Admin ===
  async registerAdmin({ username, full_name, email, nomer_induk, password }) {
    const { data: admins, error: errCount } = await this._supabase
      .from("profiles")
      .select("*")
      .eq("role", "admin");

    if (errCount) throw new InvariantError(errCount.message);
    if (admins.length > 0) throw new InvariantError("Admin sudah terdaftar.");

    const { data: user, error: signUpError } =
      await this._supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, full_name, nomer_induk },
      });

    if (signUpError) throw new InvariantError(signUpError.message);

    // update role ke admin
    const { error: insertError } = await this._supabase
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", user.user.id);

    if (insertError) throw new InvariantError(insertError.message);
    return { id: user.user.id, email: user.user.email };
  }

  // === Registrasi Guru / Siswa (oleh Admin) ===
  async registerUser({
    username,
    full_name,
    email,
    nomer_induk,
    password,
    role,
  }) {
    const { data: user, error: signUpError } =
      await this._supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, full_name, nomer_induk },
      });

    if (signUpError) throw new InvariantError(signUpError.message);

    const { error: insertError } = await this._supabase
      .from("profiles")
      .update({ role })
      .eq("id", user.user.id);

    if (insertError) throw new InvariantError(insertError.message);
    return { id: user.user.id, email: user.user.email, role };
  }

  // === Login ===
  async login({ email, password }) {
    const { data, error } = await this._supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new AuthenticationError("Email atau password salah.");
    if (!data.user) throw new AuthenticationError("User tidak ditemukan.");

    const { data: profile, error: pErr } = await this._supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();

    if (pErr) throw new InvariantError(pErr.message);
    if (!profile) throw new AuthenticationError("Profil tidak ditemukan.");

    return { user: data.user, profile };
  }
}
