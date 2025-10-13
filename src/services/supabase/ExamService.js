import { createClient } from "@supabase/supabase-js";
import InvariantError from "../../exceptions/InvariantError.js";
import NotFoundError from "../../exceptions/NotFoundError.js";

export default class ExamService {
  constructor() {
    this._supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }

  /* ========== Helpers ========== */

  async _getRoom(room_id) {
    const { data, error } = await this._supabase
      .from("rooms")
      .select("id, status, assessment_mechanism, question_count")
      .eq("id", room_id)
      .maybeSingle();
    if (error)
      throw new InvariantError("Gagal mengambil room: " + error.message);
    if (!data) throw new NotFoundError("Room tidak ditemukan");
    return data;
  }

  async _ensureStudentInRoom(student_id, room_id) {
    const { data, error } = await this._supabase
      .from("room_participants")
      .select("room_id")
      .eq("room_id", room_id)
      .eq("student_id", student_id)
      .maybeSingle();
    if (error)
      throw new InvariantError(
        "Gagal memeriksa peserta room: " + error.message
      );
    if (!data) throw new InvariantError("Anda belum tergabung dalam room ini");
  }

  async _getAnsweredQuestionIds(student_id, room_id) {
    const { data, error } = await this._supabase
      .from("student_answers")
      .select("question_id")
      .eq("student_id", student_id)
      .eq("room_id", room_id);
    if (error)
      throw new InvariantError(
        "Gagal mengambil riwayat jawaban: " + error.message
      );
    return (data ?? []).map((d) => d.question_id);
  }

  async _getRandomQuestions(limit, excludeIds = []) {
    const { data, error } = await this._supabase
      .from("questions")
      .select(
        "id, topic_id, question_text, image_url, option_a, option_b, option_c, option_d, option_e, correct_answer, difficulty_level"
      )
      .limit(500);
    if (error)
      throw new InvariantError("Gagal mengambil soal acak: " + error.message);

    const pool = (data ?? []).filter((q) => !excludeIds.includes(q.id));
    if (pool.length === 0) return [];

    const shuffled = pool.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, limit);
  }

  async _getRandomQuestionByLevel(level, excludeIds = []) {
    const { data, error } = await this._supabase
      .from("questions")
      .select(
        "id, topic_id, question_text, image_url, option_a, option_b, option_c, option_d, option_e, correct_answer, difficulty_level"
      )
      .eq("difficulty_level", level)
      .limit(500);
    if (error)
      throw new InvariantError(
        "Gagal mengambil soal by level: " + error.message
      );
    const pool = (data ?? []).filter((q) => !excludeIds.includes(q.id));
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async _getStaticRoomSet(room_id) {
    const { data, error } = await this._supabase
      .from("room_questions")
      .select(
        "question_id, questions:question_id(id, topic_id, question_text, image_url, option_a, option_b, option_c, option_d, option_e, correct_answer, difficulty_level)"
      )
      .eq("room_id", room_id);
    if (error)
      throw new InvariantError(
        "Gagal mengambil set soal room (static): " + error.message
      );
    return (data ?? []).map((d) => d.questions);
  }

  _calcCorrect(correct_answer, student_answer) {
    return (
      String(correct_answer).toUpperCase().trim() ===
      String(student_answer).toUpperCase().trim()
    );
  }

  _weightsForVariableLength(question_count) {
    const base = 100 / question_count;
    const delta = base * 0.2; // bobot kenaikan tiap level
    const w1 = base;
    const w2 = w1 + delta;
    const w3 = w2 + delta;
    return { w1, w2, w3 };
  }

  async _progressAdaptive(student_id, room_id) {
    // hitung level berdasarkan pola 2 benar / 2 salah beruntun
    const { data, error } = await this._supabase
      .from("student_answers")
      .select("is_correct, question_level_at_attempt")
      .eq("student_id", student_id)
      .eq("room_id", room_id)
      .order("answered_at", { ascending: true });

    if (error)
      throw new InvariantError(
        "Gagal membaca progres adaptif: " + error.message
      );

    let level = 2;
    let streakCorrect = 0;
    let streakWrong = 0;

    for (const row of data ?? []) {
      const correct = row.is_correct;

      if (correct) {
        streakCorrect++;
        streakWrong = 0;
        if (streakCorrect === 2 && level < 3) {
          level++;
          streakCorrect = 0;
        }
      } else {
        streakWrong++;
        streakCorrect = 0;
        if (streakWrong === 2 && level > 1) {
          level--;
          streakWrong = 0;
        }
      }
    }

    return { current_level: level, streakCorrect, streakWrong };
  }

  async _computeScores(student_id, room, mech) {
    const { data, error } = await this._supabase
      .from("student_answers")
      .select("is_correct, question_level_at_attempt, time_taken_seconds")
      .eq("student_id", student_id)
      .eq("room_id", room.id);
    if (error)
      throw new InvariantError(
        "Gagal mengambil jawaban untuk skor: " + error.message
      );

    const totalCorrect = (data ?? []).filter((d) => d.is_correct).length;
    const totalTime = (data ?? []).reduce(
      (sum, d) => sum + (d.time_taken_seconds ?? 0),
      0
    );
    const avgTime = data?.length ? totalTime / data.length : 0;

    if (mech === "adaptive_variable_length") {
      const { w1, w2, w3 } = this._weightsForVariableLength(
        room.question_count
      );
      const add = (lvl) => (lvl === 1 ? w1 : lvl === 2 ? w2 : w3);

      let expectation = 0;
      let trueScore = 0;
      for (const row of data ?? []) {
        const lvl = row.question_level_at_attempt ?? 2;
        const inc = add(lvl);
        expectation += inc;
        if (row.is_correct) trueScore += inc;
      }

      return {
        total_questions_answered: data?.length ?? 0,
        total_correct: totalCorrect,
        expectation_score: expectation,
        true_score: trueScore,
        total_time_seconds: totalTime,
        avg_time_per_question: avgTime,
      };
    }

    const trueScore =
      room.question_count > 0 ? (totalCorrect / room.question_count) * 100 : 0;

    return {
      total_questions_answered: data?.length ?? 0,
      total_correct: totalCorrect,
      expectation_score: null,
      true_score: trueScore,
      total_time_seconds: totalTime,
      avg_time_per_question: avgTime,
    };
  }

  /* ========== Exam Flow ========== */

  async startExam(student_id, { room_id }) {
    const room = await this._getRoom(room_id);
    if (room.status !== "mulai_ujian")
      throw new InvariantError("Room belum memulai ujian");
    await this._ensureStudentInRoom(student_id, room_id);

    const answeredIds = await this._getAnsweredQuestionIds(student_id, room_id);
    let nextQ = null;

    if (room.assessment_mechanism === "static") {
      const preset = await this._getStaticRoomSet(room_id);
      const remaining = preset.filter((q) => !answeredIds.includes(q.id));
      if (!remaining.length)
        return { done: true, message: "Tidak ada soal tersisa" };
      nextQ = remaining[0];
    } else if (room.assessment_mechanism === "random") {
      const picks = await this._getRandomQuestions(1, answeredIds);
      if (!picks.length)
        return { done: true, message: "Tidak ada soal tersisa" };
      nextQ = picks[0];
    } else {
      nextQ = await this._getRandomQuestionByLevel(2, answeredIds);
      if (!nextQ)
        return { done: true, message: "Tidak ada soal level 2 tersedia" };
    }

    return { done: false, question: this._exposeQuestion(nextQ) };
  }

  _exposeQuestion(q) {
    const { correct_answer, ...pub } = q;
    return pub;
  }

  async answerAndNext(
    student_id,
    { room_id, question_id, answer, time_taken_seconds }
  ) {
    const room = await this._getRoom(room_id);
    if (room.status !== "mulai_ujian")
      throw new InvariantError("Room belum memulai ujian");
    await this._ensureStudentInRoom(student_id, room_id);

    // ambil soal + snapshot level
    const { data: q, error: qErr } = await this._supabase
      .from("questions")
      .select(
        "id, correct_answer, difficulty_level, question_text, image_url, option_a, option_b, option_c, option_d, option_e"
      )
      .eq("id", question_id)
      .maybeSingle();
    if (qErr) throw new InvariantError("Gagal mengambil soal: " + qErr.message);
    if (!q) throw new NotFoundError("Soal tidak ditemukan");

    const is_correct = this._calcCorrect(q.correct_answer, answer);

    // simpan jawaban + level snapshot
    const insertRow = {
      student_id,
      room_id,
      question_id,
      student_answer: answer,
      is_correct,
      time_taken_seconds,
      question_level_at_attempt: q.difficulty_level,
    };
    const { error: insErr } = await this._supabase
      .from("student_answers")
      .insert(insertRow);
    if (insErr)
      throw new InvariantError("Gagal menyimpan jawaban: " + insErr.message);

    const answeredIds = await this._getAnsweredQuestionIds(student_id, room_id);

    /* ==== Mekanisme Static ==== */
    if (room.assessment_mechanism === "static") {
      const preset = await this._getStaticRoomSet(room_id);
      const remaining = preset.filter((qq) => !answeredIds.includes(qq.id));
      if (remaining.length === 0)
        return {
          done: true,
          scores: await this._computeScores(
            student_id,
            room,
            room.assessment_mechanism
          ),
        };
      return { done: false, question: this._exposeQuestion(remaining[0]) };
    }

    /* ==== Mekanisme Random ==== */
    if (room.assessment_mechanism === "random") {
      const answeredCount = answeredIds.length;
      if (answeredCount >= room.question_count)
        return {
          done: true,
          scores: await this._computeScores(
            student_id,
            room,
            room.assessment_mechanism
          ),
        };
      const picks = await this._getRandomQuestions(1, answeredIds);
      if (!picks.length)
        return {
          done: true,
          scores: await this._computeScores(
            student_id,
            room,
            room.assessment_mechanism
          ),
        };
      return { done: false, question: this._exposeQuestion(picks[0]) };
    }

    /* ==== Mekanisme Adaptive Fixed Length ==== */
    if (room.assessment_mechanism === "adaptive_fixed_length") {
      const prog = await this._progressAdaptive(student_id, room_id);
      const nextLevel = prog.current_level; // gunakan level dari progres adaptif saja

      const answeredCount = answeredIds.length;
      if (answeredCount >= room.question_count)
        return {
          done: true,
          scores: await this._computeScores(
            student_id,
            room,
            room.assessment_mechanism
          ),
        };

      const nextQ = await this._getRandomQuestionByLevel(
        nextLevel,
        answeredIds
      );
      if (!nextQ)
        return {
          done: true,
          scores: await this._computeScores(
            student_id,
            room,
            room.assessment_mechanism
          ),
        };
      return { done: false, question: this._exposeQuestion(nextQ) };
    }

    /* ==== Mekanisme Adaptive Variable Length ==== */
    if (room.assessment_mechanism === "adaptive_variable_length") {
      const scores = await this._computeScores(
        student_id,
        room,
        room.assessment_mechanism
      );
      if ((scores.expectation_score ?? 0) >= 100) return { done: true, scores };

      const prog = await this._progressAdaptive(student_id, room_id);
      const nextLevel = prog.current_level;

      const nextQ = await this._getRandomQuestionByLevel(
        nextLevel,
        answeredIds
      );
      if (!nextQ) return { done: true, scores };
      return { done: false, question: this._exposeQuestion(nextQ) };
    }

    throw new InvariantError("Mekanisme ujian tidak dikenali");
  }

  async finish(student_id, { room_id }) {
    const room = await this._getRoom(room_id);
    await this._ensureStudentInRoom(student_id, room_id);

    const scores = await this._computeScores(
      student_id,
      room,
      room.assessment_mechanism
    );

    // simpan hasil akhir ke room_participants
    const { error: updateErr } = await this._supabase
      .from("room_participants")
      .update({
        total_questions_answered: scores.total_questions_answered,
        total_correct: scores.total_correct,
        true_score: scores.true_score,
        expectation_score: scores.expectation_score,
        total_time_seconds: scores.total_time_seconds,
        avg_time_per_question: scores.avg_time_per_question,
        finished_at: new Date().toISOString(),
      })
      .eq("room_id", room_id)
      .eq("student_id", student_id);

    if (updateErr)
      throw new InvariantError(
        "Gagal menyimpan hasil ujian ke room_participants: " + updateErr.message
      );

    return scores;
  }

  async result(student_id, room_id) {
    const room = await this._getRoom(room_id);
    await this._ensureStudentInRoom(student_id, room_id);
    return this._computeScores(student_id, room, room.assessment_mechanism);
  }
}
