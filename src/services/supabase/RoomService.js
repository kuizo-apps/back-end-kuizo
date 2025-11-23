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

      const { data } = await this._supabase
        .from("rooms")
        .select("id")
        .eq("keypass", keypass)
        .maybeSingle();

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
    if (error) throw new InvariantError("Gagal cek room: " + error.message);
    if (!data) throw new NotFoundError("Room tidak ditemukan");
    if (data.created_by !== ownerId)
      throw new InvariantError("Anda tidak memiliki akses ke room ini");
  }

  /* ============== ROOMS CREATION & LOGIC ============== */

  async _fetchQuestionsForRoom(subjectId, classLevel, topicIds, limit) {
    let query = this._supabase
      .from("questions")
      .select("id, topic_id, topics!inner(id, subject_id, class_level)");

    query = query
      .eq("topics.subject_id", subjectId)
      .eq("topics.class_level", classLevel);

    if (topicIds && topicIds.length > 0) {
      query = query.in("topic_id", topicIds);
    }

    const { data, error } = await query;

    if (error)
      throw new InvariantError("Gagal mengambil bank soal: " + error.message);

    if (!data || data.length < limit) {
      throw new InvariantError(
        `Soal tidak cukup. Tersedia: ${
          data?.length || 0
        }, Diminta: ${limit}. Silakan kurangi jumlah soal atau tambah bank soal.`
      );
    }

    const shuffled = data.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, limit);
  }

  async createRoom(payload, creatorId) {
    const {
      name,
      question_count,
      assessment_mechanism,
      subject_id,
      class_level,
      topic_ids,
    } = payload;

    const keypass = await this._generateKeypass();

    const roomPayload = {
      name,
      keypass,
      status: "persiapan",
      assessment_mechanism,
      question_count,
      created_by: creatorId,
      subject_id,  
      class_level,  
      topic_config: topic_ids && topic_ids.length > 0 ? topic_ids : null,  
    };

    const { data: room, error } = await this._supabase
      .from("rooms")
      .insert(roomPayload)
      .select()
      .single();

    if (error) throw new InvariantError("Gagal membuat room: " + error.message);

    if (assessment_mechanism === "static") {
      try {
        const selectedQuestions = await this._fetchQuestionsForRoom(
          subject_id,
          class_level,
          topic_ids,
          question_count
        );

        const insertQuestions = selectedQuestions.map((q) => ({
          room_id: room.id,
          question_id: q.id,
        }));

        const { error: insertErr } = await this._supabase
          .from("room_questions")
          .insert(insertQuestions);

        if (insertErr) throw insertErr;
      } catch (e) {
        await this._supabase.from("rooms").delete().eq("id", room.id);
        throw new InvariantError("Gagal generate soal otomatis: " + e.message);
      }
    }

    return room;
  }

  async listRoomsByCreator(creatorId, { q, status } = {}) {
    let query = this._supabase
      .from("rooms")
      .select(
        "id, name, keypass, status, assessment_mechanism, question_count, created_at, subject_id, class_level",
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
    const { data: room, error: rErr } = await this._supabase
      .from("rooms")
      .select(
        `id, name, keypass, status, assessment_mechanism, question_count, created_by, created_at, 
          subject_id, class_level, topic_config, 
          subjects(name)` 
      )
      .eq("id", roomId)
      .eq("created_by", creatorId)
      .maybeSingle();

    if (rErr) throw new InvariantError("Gagal detail room: " + rErr.message);
    if (!room) throw new NotFoundError("Room tidak ditemukan");

    const { count: participantCount, error: pErr } = await this._supabase
      .from("room_participants")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId);

    if (pErr) throw new InvariantError("Gagal hitung peserta: " + pErr.message);

    let existingQuestions = 0;
    if (room.assessment_mechanism === "static") {
      const { count: qCount } = await this._supabase
        .from("room_questions")
        .select("*", { count: "exact", head: true })
        .eq("room_id", roomId);
      existingQuestions = qCount;
    }

    return {
      ...room,
      total_participants: participantCount,
      total_questions_generated: existingQuestions,
    };
  }

  async updateRoomStatus(roomId, status, creatorId) {
    await this._assertRoomOwnedBy(roomId, creatorId);
    const { data, error } = await this._supabase
      .from("rooms")
      .update({ status })
      .eq("id", roomId)
      .select()
      .maybeSingle();
    if (error)
      throw new InvariantError("Gagal update status: " + error.message);
    return data;
  }

  async deleteRoom(roomId, creatorId) {
    await this._assertRoomOwnedBy(roomId, creatorId);
    const { error } = await this._supabase
      .from("rooms")
      .delete()
      .eq("id", roomId);
    if (error) throw new InvariantError("Gagal hapus room: " + error.message);
  }

  async removeParticipant(roomId, studentId, creatorId) {
    await this._assertRoomOwnedBy(roomId, creatorId);
    const { error } = await this._supabase
      .from("room_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("student_id", studentId);
    if (error)
      throw new InvariantError("Gagal hapus peserta: " + error.message);
  }

  async joinRoomByKeypass(studentId, keypass) {
    const { data: room, error } = await this._supabase
      .from("rooms")
      .select("id, status")
      .eq("keypass", keypass)
      .maybeSingle();
    if (error || !room) throw new NotFoundError("Room tidak ditemukan");
    if (room.status !== "persiapan")
      throw new InvariantError("Pendaftaran ditutup");

    const { error: upErr } = await this._supabase
      .from("room_participants")
      .upsert([{ room_id: room.id, student_id: studentId }], {
        onConflict: "room_id,student_id",
        ignoreDuplicates: true,
      });
    if (upErr) throw new InvariantError("Gagal join: " + upErr.message);
    return { room_id: room.id };
  }

  async listParticipantsByRoomForStudent(roomId, studentId) {
    const { data: joined } = await this._supabase
      .from("room_participants")
      .select("room_id")
      .eq("room_id", roomId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (!joined) throw new InvariantError("Anda bukan peserta room ini");

    const { data: room } = await this._supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();
    
    const { data: participants } = await this._supabase
      .from("room_participants")
      .select("join_timestamp, profiles(id, username, full_name, nomer_induk)")
      .eq("room_id", roomId)
      .order("join_timestamp", { ascending: true });

    return {
      room,
      participants: participants.map((p) => ({
        ...p.profiles,
        join_timestamp: p.join_timestamp,
      })),
    };
  }

  async leaveRoom(roomId, studentId) {
    const { error } = await this._supabase
      .from("room_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("student_id", studentId);
    if (error) throw new InvariantError("Gagal keluar: " + error.message);
  }

  async listMyRooms(studentId) {
    const { data } = await this._supabase
      .from("room_participants")
      .select("join_timestamp, rooms(*)")
      .eq("student_id", studentId)
      .order("join_timestamp", { ascending: false });
    return (data || []).map((d) => ({
      ...d.rooms,
      join_timestamp: d.join_timestamp,
    }));
  }
}