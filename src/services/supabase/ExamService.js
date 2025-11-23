import { createClient } from "@supabase/supabase-js";
import InvariantError from "../../exceptions/InvariantError.js";
import NotFoundError from "../../exceptions/NotFoundError.js";

export default class ExamService {
  constructor() {
    this._supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Konfigurasi Rule Based (RB)
    this.RB_CONFIG = {
      lambda_val: 5,
      prior: 50,
      win_es: 5,
      delta_thr: 2.0,
      min_ratio: 0.5, // Min 50% soal harus dijawab
      weights_cog: { C1: 1.0, C2: 1.1, C3: 1.2, C4: 1.3, C5: 1.4, C6: 1.5 },
      weights_diff: { 1: 1.0, 2: 1.2, 3: 1.4 },
      target_mastery: ["C1", "C2", "C3", "C4", "C5", "C6"],
    };
  }

  /* ================= HELPERS ================= */

  async _getRoom(room_id) {
    const { data, error } = await this._supabase
      .from("rooms")
      .select(
        "id, status, assessment_mechanism, question_count, topic_config, subject_id, class_level"
      )
      .eq("id", room_id)
      .maybeSingle();
    if (error) throw new InvariantError("Gagal ambil room: " + error.message);
    if (!data) throw new NotFoundError("Room tidak ditemukan");
    return data;
  }

  async _getParticipant(student_id, room_id) {
    const { data, error } = await this._supabase
      .from("room_participants")
      .select("*")
      .eq("room_id", room_id)
      .eq("student_id", student_id)
      .maybeSingle();
    if (error) throw new InvariantError("Error cek peserta: " + error.message);
    if (!data) throw new InvariantError("Anda belum tergabung dalam room ini");
    return data;
  }

  async _getQuestionDetail(id, hideAnswer = true) {
    const { data } = await this._supabase
      .from("questions")
      .select(
        "id, question_text, image_url, image_caption, option_a, option_b, option_c, option_d, option_e, cognitive_level, difficulty_level, correct_answer"
      )
      .eq("id", id)
      .maybeSingle();

    if (!data) return null;

    if (hideAnswer) {
      const { correct_answer, ...rest } = data;
      return rest;
    }
    return data;
  }

  // Generate Map untuk Random (Persist di DB)
  async _generateAndSaveRandomMap(student_id, room_id, room) {
    // Query soal filter subject, class, topic
    let query = this._supabase
      .from("questions")
      .select("id, topic_id, topics!inner(id, subject_id, class_level)");

    query = query
      .eq("topics.subject_id", room.subject_id)
      .eq("topics.class_level", room.class_level);

    if (room.topic_config && room.topic_config.length > 0) {
      query = query.in("topic_id", room.topic_config);
    }

    const { data } = await query;
    // Ambil pool soal, acak, potong sesuai question_count
    const shuffled = (data || [])
      .sort(() => 0.5 - Math.random())
      .slice(0, room.question_count);
    const questionIds = shuffled.map((q) => q.id);

    // Simpan map ke DB
    await this._supabase
      .from("room_participants")
      .update({ question_map: questionIds })
      .eq("room_id", room_id)
      .eq("student_id", student_id);

    return questionIds;
  }

  // Ambil Map Static
  async _getStaticMap(room_id) {
    const { data } = await this._supabase
      .from("room_questions")
      .select("question_id")
      .eq("room_id", room_id);
    return (data || []).map((d) => d.question_id);
  }

  _getWeight(cog, diff) {
    const wc = this.RB_CONFIG.weights_cog[cog] || 1.0;
    const wd = this.RB_CONFIG.weights_diff[diff] || 1.0;
    return wc * wd;
  }

  _calculateES(answers) {
    const { lambda_val, prior } = this.RB_CONFIG;
    let true_w = 0;
    let tot_w = 0;

    answers.forEach((a) => {
      const diff = a.question_level_at_attempt || 1;
      const w = this._getWeight(a.cognitive_level, diff);
      tot_w += w;
      if (a.is_correct) true_w += w;
    });

    const es = (lambda_val * prior + 100 * true_w) / (lambda_val + tot_w);
    return parseFloat(es.toFixed(2));
  }

  _determineNextLevel(currentCog, currentDiff, isCorrect) {
    const cogs = ["C1", "C2", "C3", "C4", "C5", "C6"];
    const cogIdx = cogs.indexOf(currentCog);

    if (isCorrect) {
      if (currentDiff < 3) return { cog: currentCog, diff: currentDiff + 1 };
      if (cogIdx < 5) return { cog: cogs[cogIdx + 1], diff: 3 };
      return { cog: "C6", diff: 3 };
    } else {
      if (currentDiff > 1) return { cog: currentCog, diff: currentDiff - 1 };
      return { cog: currentCog, diff: 1 };
    }
  }

  async _getRuleBasedNextQuestion(room, excludeIds, targetCog, targetDiff) {
    let query = this._supabase
      .from("questions")
      .select("id, topics!inner(subject_id, class_level)")
      .eq("topics.subject_id", room.subject_id)
      .eq("topics.class_level", room.class_level)
      .eq("cognitive_level", targetCog)
      .eq("difficulty_level", targetDiff);

    if (room.topic_config && room.topic_config.length > 0) {
      query = query.in("topic_id", room.topic_config);
    }

    const { data } = await query.limit(300); // Ambil pool kandidat
    if (!data || data.length === 0) return null;

    const candidates = data.filter((q) => !excludeIds.includes(q.id));
    if (candidates.length === 0) return null;

    const randomIdx = Math.floor(Math.random() * candidates.length);
    return candidates[randomIdx].id;
  }

  async _checkStopCondition(answers, max_items) {
    const { win_es, delta_thr, min_ratio, target_mastery } = this.RB_CONFIG;
    const n = answers.length;
    const min_questions = Math.max(Math.floor(max_items * min_ratio), 1);

    let shouldStop = false;
    let stopReason = null;

    if (n >= win_es) {
      const lastN = answers.slice(-win_es).map((a) => a.es_value);
      if (lastN.every((v) => v !== null && v !== undefined)) {
        const maxVal = Math.max(...lastN);
        const minVal = Math.min(...lastN);
        if (maxVal - minVal <= delta_thr) {
          shouldStop = true;
          stopReason = "Score stable";
        }
      }
    }

    const masteredLevels = new Set(
      answers.filter((a) => a.is_correct).map((a) => a.cognitive_level)
    );

    const isAllMastered = target_mastery.every((target) =>
      masteredLevels.has(target)
    );

    if (isAllMastered) {
      shouldStop = true;
      stopReason = "All cognitive levels mastered";
    }

    if (n >= max_items) {
      shouldStop = true;
      stopReason = "Max items reached";
    }

    if (n < min_questions) {
      shouldStop = false;
      stopReason = null;
    }

    return { stop: shouldStop, reason: stopReason };
  }

  /* ================= FLOW START ================= */

  async startExam(student_id, { room_id }) {
    const room = await this._getRoom(room_id);
    if (room.status !== "berlangsung")
      throw new InvariantError("Ujian belum dimulai/sudah selesai");

    const participant = await this._getParticipant(student_id, room_id);

    // === A. STATIC & RANDOM (Map Based) ===
    if (room.assessment_mechanism !== "rule_based") {
      let map = participant.question_map;

      // Generate map jika belum ada
      if (!map || map.length === 0) {
        if (room.assessment_mechanism === "random") {
          map = await this._generateAndSaveRandomMap(student_id, room_id, room);
        } else {
          // Static: ambil dari tabel room_questions
          map = await this._getStaticMap(room_id);
          map = map.sort(() => Math.random() - 0.5);
          await this._supabase
            .from("room_participants")
            .update({ question_map: map })
            .eq("room_id", room_id)
            .eq("student_id", student_id);
        }
      }

      // Cek soal yg sudah dijawab
      const { data: answers } = await this._supabase
        .from("student_answers")
        .select("question_id")
        .eq("room_id", room_id)
        .eq("student_id", student_id)
        .not("student_answer", "is", null);

      const answeredIds = (answers || []).map((a) => a.question_id);

      // Cari index pertama yg belum dijawab (utk direct link)
      const nextQId = map.find((id) => !answeredIds.includes(id));

      if (!nextQId) return { done: true, message: "Semua soal telah dijawab." };

      const questionData = await this._getQuestionDetail(nextQId);

      return {
        done: false,
        mechanism: room.assessment_mechanism,
        question_map: map, // Array ID Soal untuk navigasi FE
        current_question: questionData,
        answered_ids: answeredIds,
      };
    }

    // === B. RULE BASED (Sequential) ===
    else {
      const { data: rawAnswers } = await this._supabase
        .from("student_answers")
        .select(
          "question_id, is_correct, cognitive_level, question_level_at_attempt, es_value"
        )
        .eq("room_id", room_id)
        .eq("student_id", student_id)
        .order("answered_at", { ascending: true });

      // Map DB column to Logic Key
      const answers = (rawAnswers || []).map((a) => ({
        ...a,
        difficulty_level: a.question_level_at_attempt,
      }));

      // Cek Stop
      const stopCheck = await this._checkStopCondition(
        answers,
        room.question_count
      );
      if (stopCheck.stop) return { done: true, message: "Ujian selesai." };

      let nextQId = null;

      if (answers.length === 0) {
        nextQId = await this._getRuleBasedNextQuestion(room, [], "C1", 1);
      } else {
        const last = answers[answers.length - 1];
        const excludeIds = answers.map((a) => a.question_id);
        const nextParams = this._determineNextLevel(
          last.cognitive_level,
          last.difficulty_level,
          last.is_correct
        );
        nextQId = await this._getRuleBasedNextQuestion(
          room,
          excludeIds,
          nextParams.cog,
          nextParams.diff
        );

        if (!nextQId) return { done: true, message: "Bank soal habis." };
      }

      const questionData = await this._getQuestionDetail(nextQId);
      const is_last = answers.length + 1 >= room.question_count;

      return {
        done: false,
        mechanism: "rule_based",
        question_map: null, // Disable map navigation
        current_question: questionData,
        answered_count: answers.length,
        is_last_question: is_last,
      };
    }
  }

  /* ================= FLOW ANSWER ================= */

  async answerAndNext(
    student_id,
    { room_id, question_id, answer, time_taken_seconds }
  ) {
    const room = await this._getRoom(room_id);
    if (room.status !== "berlangsung")
      throw new InvariantError("Ujian tidak aktif");

    const qDb = await this._getQuestionDetail(question_id, false);
    if (!qDb) throw new NotFoundError("Soal tidak valid");

    // 1. Determine Correctness
    let is_correct = false;
    if (answer && typeof answer === "string" && answer.trim() !== "") {
      is_correct = qDb.correct_answer.toUpperCase() === answer.toUpperCase();
    }

    // 2. Payload Dasar
    const payload = {
      student_id,
      room_id,
      question_id,
      student_answer: answer === "" ? null : answer,
      is_correct,
      time_taken_seconds,
      cognitive_level: qDb.cognitive_level,
      question_level_at_attempt: qDb.difficulty_level,
      answered_at: new Date().toISOString(), // Penting untuk update timestamp terakhir
    };

    // ==========================================
    // A. LOGIKA RULE BASED (Sequential / Adaptive)
    // ==========================================
    if (room.assessment_mechanism === "rule_based") {
      const { data: prevAnswers } = await this._supabase
        .from("student_answers")
        .select("is_correct, cognitive_level, question_level_at_attempt")
        .eq("room_id", room_id)
        .eq("student_id", student_id);

      const historyForCalc = (prevAnswers || []).map((p) => ({
        ...p,
        difficulty_level: p.question_level_at_attempt,
      }));
      const currentForCalc = {
        ...payload,
        difficulty_level: payload.question_level_at_attempt,
      };

      payload.es_value = this._calculateES([...historyForCalc, currentForCalc]);

      // Rule Based umumnya insert sequential.
      // Kita gunakan upsert jaga-jaga jika user double click, agar tidak error duplicate key.
      const { error } = await this._supabase
        .from("student_answers")
        .upsert(payload, { onConflict: "room_id, student_id, question_id" });

      if (error)
        throw new InvariantError("Gagal simpan jawaban: " + error.message);

      // Re-fetch updated history
      const { data: updatedRaw } = await this._supabase
        .from("student_answers")
        .select(
          "question_id, is_correct, cognitive_level, question_level_at_attempt, es_value"
        )
        .eq("room_id", room_id)
        .eq("student_id", student_id)
        .order("answered_at", { ascending: true });

      const updatedHistory = updatedRaw.map((a) => ({
        ...a,
        difficulty_level: a.question_level_at_attempt,
      }));

      // Check Stop
      const stopCheck = await this._checkStopCondition(
        updatedHistory,
        room.question_count
      );
      if (stopCheck.stop) {
        const result = await this.finish(student_id, { room_id });
        return { done: true, result };
      }

      // Determine Next
      const last = updatedHistory[updatedHistory.length - 1];
      const excludeIds = updatedHistory.map((a) => a.question_id);
      const nextParams = this._determineNextLevel(
        last.cognitive_level,
        last.difficulty_level,
        last.is_correct
      );

      const nextQId = await this._getRuleBasedNextQuestion(
        room,
        excludeIds,
        nextParams.cog,
        nextParams.diff
      );
      if (!nextQId) return { done: true, message: "Soal habis" };

      const nextData = await this._getQuestionDetail(nextQId);
      const is_last = updatedHistory.length + 1 >= room.question_count;

      return {
        done: false,
        question: nextData,
        is_last_question: is_last,
        mechanism: "rule_based",
      };
    }

    // ==========================================
    // B. LOGIKA RANDOM & STATIC (Fleksibel / Navigasi Bebas)
    // ==========================================
    else {
      // 1. UPSERT: Agar user bisa kembali ke soal sebelumnya dan mengubah jawaban.
      // Sesuai dengan constraint: unique (room_id, student_id, question_id)
      const { error } = await this._supabase
        .from("student_answers")
        .upsert(payload, { onConflict: "room_id, student_id, question_id" });

      if (error)
        throw new InvariantError("Gagal simpan jawaban: " + error.message);

      // 2. Ambil Data Navigasi Terbaru (Map & Status Jawaban)
      const participant = await this._getParticipant(student_id, room_id);
      const map = participant.question_map || [];

      // Ambil semua soal yang sudah dijawab untuk update warna di frontend
      const { data: allAnswers } = await this._supabase
        .from("student_answers")
        .select("question_id")
        .eq("room_id", room_id)
        .eq("student_id", student_id)
        .not("student_answer", "is", null);

      const answeredIds = (allAnswers || []).map((a) => a.question_id);

      // 3. Tentukan Soal Berikutnya (Sequential Map)
      const currentIndex = map.indexOf(question_id);

      // Default: Next question adalah index + 1
      let nextData = null;
      let nextIndex = currentIndex + 1;

      // Jika masih ada soal berikutnya di map
      if (nextIndex < map.length) {
        const nextQId = map[nextIndex];
        nextData = await this._getQuestionDetail(nextQId);
      }

      const is_last = nextIndex >= map.length;

      return {
        done: false,
        mechanism: room.assessment_mechanism,
        question: nextData, // Bisa null jika user menjawab soal terakhir

        // Data Navigasi Lengkap untuk Frontend
        current_index: nextIndex + 1, // Untuk display "Soal 2 dari 10"
        total_questions: map.length,
        is_last_question: is_last,

        question_map: map, // Agar tombol navigasi tetap ada
        answered_ids: answeredIds, // Agar tombol berubah warna (hijau)
      };
    }
  }

  /* ================= NAVIGASI BEBAS (JUMP TO QUESTION) ================= */

  async getSpecificQuestion(student_id, { room_id, question_id }) {
    // 1. Validasi Room & Peserta
    const room = await this._getRoom(room_id);
    if (room.status !== "berlangsung") {
      // Opsional: Bolehkan akses jika status 'berakhir' untuk review,
      // tapi untuk ujian, biasanya harus 'berlangsung'.
      // throw new InvariantError("Sesi ujian tidak aktif");
    }

    // Pastikan siswa adalah peserta room ini
    await this._getParticipant(student_id, room_id);

    // 2. Ambil Detail Soal
    const questionData = await this._getQuestionDetail(question_id);
    if (!questionData) throw new NotFoundError("Soal tidak ditemukan");

    // 3. Ambil Jawaban Siswa Sebelumnya (Untuk Pre-fill UI)
    const { data: prevAnswer } = await this._supabase
      .from("student_answers")
      .select("student_answer")
      .eq("room_id", room_id)
      .eq("student_id", student_id)
      .eq("question_id", question_id)
      .maybeSingle();

    // 4. Gabungkan Data
    return {
      ...questionData,
      student_answer: prevAnswer ? prevAnswer.student_answer : null,
    };
  }

  /* ================= FINISH ================= */

  async finish(student_id, { room_id }) {
    const room = await this._getRoom(room_id);

    // Fetch semua jawaban untuk kalkulasi score & WAKTU
    const { data: answers } = await this._supabase
      .from("student_answers")
      .select("*")
      .eq("room_id", room_id)
      .eq("student_id", student_id);

    const total_answered = answers ? answers.length : 0;
    const total_correct = (answers || []).filter((a) => a.is_correct).length;

    // Hitung Total Waktu
    const total_time_seconds = (answers || []).reduce((acc, curr) => {
      return acc + (curr.time_taken_seconds || 0);
    }, 0);

    let final_score = 0;

    if (room.assessment_mechanism === "rule_based") {
      let w_attempted = 0;
      let w_correct = 0;
      (answers || []).forEach((a) => {
        const diff = a.question_level_at_attempt || 1;
        const w = this._getWeight(a.cognitive_level, diff);
        w_attempted += w;
        if (a.is_correct) w_correct += w;
      });
      if (w_attempted > 0) final_score = (w_correct / w_attempted) * 100;
    } else {
      if (room.question_count > 0) {
        final_score = (total_correct / room.question_count) * 100;
      }
    }

    final_score = parseFloat(final_score.toFixed(2));

    await this._supabase
      .from("room_participants")
      .update({
        total_questions_answered: total_answered,
        total_correct: total_correct,
        true_score: final_score,
        total_time_seconds: total_time_seconds,
        finished_at: new Date().toISOString(),
      })
      .eq("room_id", room_id)
      .eq("student_id", student_id);

    return { score: final_score, correct: total_correct };
  }

  async result(student_id, room_id) {
    const { data } = await this._supabase
      .from("room_participants")
      .select(
        "true_score, total_correct, total_questions_answered, finished_at"
      )
      .eq("room_id", room_id)
      .eq("student_id", student_id)
      .single();
    if (!data) throw new NotFoundError("Data tidak ditemukan");
    return data;
  }
}
