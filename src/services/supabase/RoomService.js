import { createClient } from "@supabase/supabase-js";
import InvariantError from "../../exceptions/InvariantError.js";
import NotFoundError from "../../exceptions/NotFoundError.js";

export default class RoomService {
  constructor() {
    this._supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }

  /* ============== UTIL ============== */
  async _generateKeypass() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let keypass;
    let exists = true;

    while (exists) {
      keypass = Array.from(
        { length: 8 },
        () => chars[Math.floor(Math.random() * chars.length)]
      ).join("");

      const { data, error } = await this._supabase
        .from("rooms")
        .select("id")
        .eq("keypass", keypass)
        .maybeSingle();

      if (error) {
        throw new InvariantError("Gagal memeriksa keypass: " + error.message);
      }
      exists = !!data;
    }
    return keypass;
  }

  async _assertRoomOwnedBy(roomId, ownerId) {
    const { data, error } = await this._supabase
      .from("rooms")
      .select("id, created_by")
      .eq("id", roomId)
      .maybeSingle();
    if (error)
      throw new InvariantError(
        "Gagal memeriksa pemilik room: " + error.message
      );
    if (!data) throw new NotFoundError("Room tidak ditemukan");
    if (data.created_by !== ownerId)
      throw new InvariantError("Anda tidak memiliki akses ke room ini");
  }

  /* ============== ROOMS (Guru/Admin) ============== */
  async createRoom({ name, question_count, assessment_mechanism }, creatorId) {
    const keypass = await this._generateKeypass();
    const payload = {
      name,
      keypass,
      status: "persiapan",
      assessment_mechanism,
      question_count,
      created_by: creatorId,
    };

    const { data, error } = await this._supabase
      .from("rooms")
      .insert(payload)
      .select(
        "id, name, keypass, status, assessment_mechanism, question_count, created_by, created_at"
      )
      .single();

    if (error) throw new InvariantError("Gagal membuat room: " + error.message);
    return data;
  }

  async listRoomsByCreator(creatorId, { q, status } = {}) {
    let query = this._supabase
      .from("rooms")
      .select(
        "id, name, keypass, status, assessment_mechanism, question_count, created_at",
        { count: "exact" }
      )
      .eq("created_by", creatorId)
      .order("created_at", { ascending: false });

    if (q) query = query.ilike("name", `%${q}%`);
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error)
      throw new InvariantError("Gagal mengambil daftar room: " + error.message);
    return { data, meta: { total: count ?? 0 } };
  }

  async getRoomDetail(roomId, creatorId) {
    // Batasi pada room milik creator
    const { data: room, error: rErr } = await this._supabase
      .from("rooms")
      .select(
        "id, name, keypass, status, assessment_mechanism, question_count, created_by, created_at"
      )
      .eq("id", roomId)
      .eq("created_by", creatorId)
      .maybeSingle();

    if (rErr)
      throw new InvariantError("Gagal mengambil detail room: " + rErr.message);
    if (!room) throw new NotFoundError("Room tidak ditemukan");

    const { data: participants, error: pErr } = await this._supabase
      .from("room_participants")
      .select(
        "student_id, join_timestamp, profiles:student_id(id, username, full_name, email, nomer_induk)"
      )
      .eq("room_id", roomId)
      .order("join_timestamp", { ascending: true });

    if (pErr)
      throw new InvariantError("Gagal mengambil peserta room: " + pErr.message);

    return { ...room, participants };
  }

  async updateRoomStatus(roomId, status, creatorId) {
    await this._assertRoomOwnedBy(roomId, creatorId);

    const { data, error } = await this._supabase
      .from("rooms")
      .update({ status })
      .eq("id", roomId)
      .select(
        "id, name, keypass, status, assessment_mechanism, question_count, created_at"
      )
      .maybeSingle();

    if (error)
      throw new InvariantError(
        "Gagal memperbarui status room: " + error.message
      );
    if (!data) throw new NotFoundError("Room tidak ditemukan");
    return data;
  }

  async deleteRoom(roomId, creatorId) {
    await this._assertRoomOwnedBy(roomId, creatorId);

    const { error } = await this._supabase
      .from("rooms")
      .delete()
      .eq("id", roomId);
    if (error)
      throw new InvariantError("Gagal menghapus room: " + error.message);
  }

  async removeParticipant(roomId, studentId, creatorId) {
    await this._assertRoomOwnedBy(roomId, creatorId);

    const { error } = await this._supabase
      .from("room_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("student_id", studentId);

    if (error)
      throw new InvariantError("Gagal menghapus peserta: " + error.message);
  }

  /* ============== PARTICIPATION (Siswa) ============== */
  async joinRoomByKeypass(studentId, keypass) {
    const { data: room, error: rErr } = await this._supabase
      .from("rooms")
      .select("id, status")
      .eq("keypass", keypass)
      .maybeSingle();

    if (rErr) throw new InvariantError("Gagal mencari room: " + rErr.message);
    if (!room)
      throw new NotFoundError("Room dengan keypass tersebut tidak ditemukan");
    if (room.status !== "persiapan")
      throw new InvariantError(
        "Room tidak dalam status 'persiapan' — pendaftaran ditutup"
      );

    // upsert participant
    const { error: upErr } = await this._supabase
      .from("room_participants")
      .upsert([{ room_id: room.id, student_id: studentId }], {
        onConflict: "room_id,student_id",
        ignoreDuplicates: true,
      });
    if (upErr)
      throw new InvariantError("Gagal bergabung ke room: " + upErr.message);

    return { room_id: room.id };
  }

  async leaveRoom(roomId, studentId) {
    const { error } = await this._supabase
      .from("room_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("student_id", studentId);

    if (error)
      throw new InvariantError("Gagal keluar dari room: " + error.message);
  }

  async listMyRooms(studentId) {
    const { data, error } = await this._supabase
      .from("room_participants")
      .select(
        "room_id, join_timestamp, rooms:room_id(id, name, keypass, status, assessment_mechanism, question_count, created_at)"
      )
      .eq("student_id", studentId)
      .order("join_timestamp", { ascending: false });

    if (error)
      throw new InvariantError(
        "Gagal mengambil daftar room saya: " + error.message
      );
    // Flatten
    return (data ?? []).map((d) => ({
      ...d.rooms,
      join_timestamp: d.join_timestamp,
    }));
  }

  /* ============== STATIC ROOM QUESTION SETUP ============== */
  async generateStaticQuestions(roomId, creatorId) {
    await this._assertRoomOwnedBy(roomId, creatorId);

    const { data: room, error: rErr } = await this._supabase
      .from("rooms")
      .select("id, question_count, assessment_mechanism")
      .eq("id", roomId)
      .maybeSingle();
    if (rErr)
      throw new InvariantError("Gagal membaca data room: " + rErr.message);
    if (!room) throw new NotFoundError("Room tidak ditemukan");
    if (room.assessment_mechanism !== "static")
      throw new InvariantError(
        "Hanya room dengan mekanisme 'static' yang bisa diisi soal"
      );

    // hapus jika sebelumnya sudah ada set soal
    const { error: delErr } = await this._supabase
      .from("room_questions")
      .delete()
      .eq("room_id", roomId);
    if (delErr)
      throw new InvariantError(
        "Gagal membersihkan soal lama: " + delErr.message
      );

    // ambil 1000 soal acak di sisi JS
    const { data: pool, error: qErr } = await this._supabase
      .from("questions")
      .select("id")
      .limit(1000);

    if (qErr)
      throw new InvariantError("Gagal mengambil soal acak: " + qErr.message);
    if (!pool || pool.length === 0)
      throw new InvariantError(
        "Bank soal kosong, tidak bisa generate set static"
      );

    // acak manual
    const shuffled = pool.sort(() => 0.5 - Math.random());
    const questions = shuffled.slice(0, room.question_count);

    // insert ke room_questions
    const insertPayload = questions.map((q) => ({
      room_id: room.id,
      question_id: q.id,
    }));

    const { error: iErr } = await this._supabase
      .from("room_questions")
      .insert(insertPayload);
    if (iErr)
      throw new InvariantError(
        "Gagal menyimpan set soal static: " + iErr.message
      );

    return { room_id: room.id, total_inserted: insertPayload.length };
  }
}
