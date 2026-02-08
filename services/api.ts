
const API_URL = 'https://script.google.com/macros/s/AKfycbyYS2mYTuEi_OsaMeJGS5qIqC6eeE3C87d_TGauLqxySiE6UETjNwcGi-pbsdTksMSzhA/exec'.trim();

const safeString = (val: any): string => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return (val.value !== undefined ? val.value : JSON.stringify(val)).toString();
  return String(val);
};

const safeNumber = (val: any, defaultVal: number = 0): number => {
  if (val === null || val === undefined) return defaultVal;
  let num = typeof val === 'object' ? parseFloat(val.value !== undefined ? val.value : val.toString()) : parseFloat(val);
  return isNaN(num) ? defaultVal : num;
};

const mapQuestionType = (typeStr: string): 'CHOOSE_ONE' | 'CHOOSE_MULTIPLE' | 'TRUE_FALSE' | 'SHORT_ANSWER' => {
  const t = safeString(typeStr).toUpperCase();
  if (t.includes('CHOOSE MULTIPLE') || t.includes('MULTIPLE')) return 'CHOOSE_MULTIPLE';
  if (t.includes('CHOOSE ONE') || t.includes('MCQ')) return 'CHOOSE_ONE';
  if (t.includes('TRUE') || t.includes('ĐÚNG')) return 'TRUE_FALSE';
  return 'SHORT_ANSWER';
};

export const api = {
  async getData() {
    const response = await fetch(`${API_URL}?action=init`);
    if (!response.ok) throw new Error('Failed to fetch data');
    const data = await response.json();
    return {
      users: (data.users || []).map((u: any) => ({
        account: safeString(u.Account),
        name: safeString(u.Name),
        className: safeString(u.Class),
        email: safeString(u.Email),
        progress: safeString(u.Progress || 'OFF'),
        active: safeString(u.Active || 'ON'),
        role: safeString(u.Role),
        subjectTeacher: safeString(u['Subject Teacher']),
        password: safeString(u.Password)
      })),
      subjects: (data.subjects || []).map((s: any) => ({
        stt: safeNumber(s.Stt || s.stt),
        name: safeString(s.Name || s.name),
        grade: safeNumber(s.Grade || s.grade)
      })),
      lessons: (data.lessons || []).map((l: any) => ({
        stt: safeNumber(l.Stt || l.stt),
        subjectId: safeNumber(l.Subject_id || l.SubjectID),
        name: safeString(l.Name || l.name),
        title: safeString(l.Title || l.title),
        timeoutMinutes: safeNumber(l['Timeout (minute)'] || l.Timeout),
        count: safeNumber(l.Count || l.Question_count),
        targetScore: safeNumber(l['Target score'] || l.TargetScore, 8)
      })),
      questions: (data.questions || []).map((q: any) => ({
        stt: safeNumber(q.stt || q.Stt),
        lessonId: safeNumber(q.lesson_id || q.LessonID),
        type: mapQuestionType(q.question_type || q.Type),
        level: safeString(q.quiz_level || q.Level),
        point: safeNumber(q.point),
        text: safeString(q.question_text || q.QuestionText),
        imageId: safeString(q.image_id || q.Image),
        optionA: safeString(q.option_A || q.OptionA),
        optionB: safeString(q.option_B || q.OptionB),
        optionC: safeString(q.option_C || q.OptionC),
        optionD: safeString(q.option_D || q.OptionD),
        answerKey: safeString(q.answer_key || q.Answer),
        solution: safeString(q.solution || q.Explanation)
      })),
      results: (data.results || []).map((r: any) => ({
        resultId: safeString(r.result_id || r.Result_id),
        name: safeString(r.name || r.Name),
        subjectName: safeString(r.subject_name || r.Subject_name),
        lessonName: safeString(r.lesson_name || r.Lesson_name),
        grade: safeString(r.grade || r.Grade),
        score: safeNumber(r.score || r.Score),
        totalQuestions: safeNumber(r.total_questions || r.Total_questions),
        status: (safeString(r.status || r.Status) as 'Pass' | 'Fail'),
        timeSpent: safeString(r.time_spent || r.Time_spent),
        answers: safeString(r.answers || r.Answers),
        createdDate: safeString(r.created_date || r.Created_date),
        role: safeString(r.role || r.Role)
      })),
      maintenance: data.maintenance && data.maintenance.length > 0 && safeString(data.maintenance[0].Maintenance) === 'ON',
      allClasses: (data.allClasses || []).map((c: any) => safeString(c)),
      students: (data.students || []).map((u: any) => ({
        account: safeString(u.account),
        name: safeString(u.name),
        className: safeString(u.className),
        email: safeString(u.email),
        role: safeString(u.role)
      }))
    };
  },
  async login(creds: { account: string; password?: string }) {
    const res = await fetch(API_URL, { 
      method: 'POST', 
      body: JSON.stringify({ action: 'login', ...creds }) 
    });
    const result = await res.json();
    if (result.success && result.user) {
      result.user = { 
        account: safeString(result.user.account), 
        name: safeString(result.user.name), 
        className: safeString(result.user.className), 
        email: safeString(result.user.email), 
        progress: safeString(result.user.progress), 
        active: safeString(result.user.active || 'ON'), 
        role: safeString(result.user.role),
        subjectTeacher: safeString(result.user.subjectTeacher)
      };
    }
    return result;
  },
  async saveItem(sheetName: string, item: any, idKey: string) {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'saveItem', sheetName, item, idKey })
    });
    return res.json();
  },
  async deleteItem(sheetName: string, idValue: any, idKey: string) {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteItem', sheetName, idValue, idKey })
    });
    return res.json();
  },
  async submitResult(result: any) {
    return fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitResult', result }) }).then(res => res.json());
  },
  async logout(name: string) {
    return fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'logout', name }) }).then(res => res.json());
  }
};
