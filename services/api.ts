import { User, Subject, Lesson, Question, Result } from '../types';

const API_URL = 'https://script.google.com/macros/s/AKfycbxyryq72vmTAIgmoSGeuTX5hUJLuwLXWQXn0ahnWsR2fUiudrAsNGoss9Ogj-ClHcDstQ/exec'.trim();

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
  const t = safeString(typeStr).toUpperCase().replace(/[-_]/g, ' ');
  if (t.includes('CHOOSE MULTIPLE') || t.includes('MULTIPLE') || t.includes('MANY')) return 'CHOOSE_MULTIPLE';
  if (t.includes('CHOOSE ONE') || t.includes('MCQ') || t.includes('SINGLE') || t.includes('ONE')) return 'CHOOSE_ONE';
  if (t.includes('TRUE') || t.includes('ĐÚNG') || t.includes('TF')) return 'TRUE_FALSE';
  return 'SHORT_ANSWER';
};

const cleanGrade = (gradeStr: any): string => {
  let s = safeString(gradeStr).trim();
  if (!s) return '';

  // Strip time parts like "00:00:00"
  s = s.replace(/\d{2}:\d{2}:\d{2}/, '').trim();

  // Check for 4-digit year (e.g., 2026)
  const yearMatch = s.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const year = yearMatch[1];
    s = s.replace(new RegExp(`[/-]?\\b${year}\\b[/-]?`), '').trim();
    s = s.replace(/^[/-]|[/-]$/g, '').trim();
    
    const parts = s.split(/[/-]/).map(p => parseInt(p)).filter(p => !isNaN(p));
    if (parts.length === 2) {
      const [p1, p2] = parts;
      return `${p1}.${p2}`;
    }
  }
  return s;
};

const cleanScore = (scoreVal: any): number => {
  if (scoreVal === null || scoreVal === undefined) return 0;
  if (typeof scoreVal === 'number') return scoreVal;
  
  const s = String(scoreVal).trim();
  if (!s) return 0;

  // Check if it's a date formatting serial number for year 1900
  if (s.includes('1900')) {
    const match = s.match(/(\d+)\/(\d+)\/1900/);
    if (match) {
      const p1 = parseInt(match[1]);
      const p2 = parseInt(match[2]);
      if (p2 === 1) return p1;
      if (p1 === 1) return p2;
    }
  }
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
};

const cleanTimeSpent = (timeVal: any): string => {
  let s = safeString(timeVal).trim();
  if (!s) return '';

  const timeMatch = s.match(/(\d{2}):(\d{2}):(\d{2})/);
  if (timeMatch) {
    const p1 = timeMatch[1];
    const p2 = timeMatch[2];
    return `${p1}:${p2}`;
  }
  return s;
};

// Local storage key for persistent fallback
const LS_KEY = 'edupulse_local_db';

const getInitialMockData = () => {
  return {
    users: [
      {
        account: 'admin',
        name: 'Quản trị viên hệ thống',
        className: 'Hệ thống',
        email: 'admin@edupulse.vn',
        progress: 'OFF' as const,
        active: 'ON' as const,
        role: 'admin',
        subjectTeacher: '',
        password: '123'
      },
      {
        account: 'giao_vien',
        name: 'Cô Nguyễn Thị Lan',
        className: 'Khối 10',
        email: 'lan.nt@edupulse.vn',
        progress: 'OFF' as const,
        active: 'ON' as const,
        role: 'teacher',
        subjectTeacher: 'Toán học',
        password: '123'
      },
      {
        account: 'hoc_sinh',
        name: 'Nguyễn Văn A',
        className: '10A1',
        email: 'anv@edupulse.vn',
        progress: 'OFF' as const,
        active: 'ON' as const,
        role: 'student',
        subjectTeacher: '',
        password: '123'
      }
    ],
    subjects: [
      { stt: 1, name: 'Toán học', grade: 10 },
      { stt: 2, name: 'Vật lí', grade: 10 }
    ],
    lessons: [
      { stt: 1, subjectId: 1, name: 'Hàm số bậc hai', title: 'Hàm số và đồ thị bậc hai', timeoutMinutes: 15, count: 5, targetScore: 8 },
      { stt: 2, subjectId: 1, name: 'Phương trình lượng giác', title: 'Các phương trình lượng giác cơ bản', timeoutMinutes: 15, count: 5, targetScore: 8 },
      { stt: 3, subjectId: 2, name: 'Chuyển động thẳng đều', title: 'Động học chất điểm lớp 10', timeoutMinutes: 10, count: 5, targetScore: 8 }
    ],
    questions: [
      // Toán học - Hàm số bậc hai (stt = 1)
      {
        stt: 1,
        lessonId: 1,
        type: 'CHOOSE_ONE' as const,
        level: 'Easy',
        point: 2,
        text: 'Đồ thị hàm số $y = ax^2 + bx + c$ ($a \\neq 0$) là một parabol có tọa độ đỉnh $I$ là:',
        optionA: '$I(-\\frac{b}{2a}; -\\frac{\\Delta}{4a})$',
        optionB: '$I(\\frac{b}{2a}; \\frac{\\Delta}{4a})$',
        optionC: '$I(-\\frac{b}{a}; -\\frac{\\Delta}{2a})$',
        optionD: '$I(\\frac{b}{a}; \\frac{\\Delta}{a})$',
        answerKey: 'A',
        solution: 'Tọa độ đỉnh của parabol $y = ax^2 + bx + c$ là $I(-\\frac{b}{2a}; -\\frac{\\Delta}{4a})$.'
      },
      {
        stt: 2,
        lessonId: 1,
        type: 'CHOOSE_ONE' as const,
        level: 'Medium',
        point: 2,
        text: 'Cho hàm số bậc hai $y = x^2 - 4x + 3$. Trục đối xứng của đồ thị hàm số này là đường thẳng nào?',
        optionA: '$x = 2$',
        optionB: '$x = -2$',
        optionC: '$x = 4$',
        optionD: '$x = -4$',
        answerKey: 'A',
        solution: 'Trục đối xứng là đường thẳng $x = -\\frac{b}{2a} = -\\frac{-4}{2 \\times 1} = 2$.'
      },
      {
        stt: 3,
        lessonId: 1,
        type: 'CHOOSE_ONE' as const,
        level: 'Medium',
        point: 2,
        text: 'Giá trị nhỏ nhất của hàm số $y = x^2 - 2x + 5$ trên tập xác định là:',
        optionA: '4',
        optionB: '5',
        optionC: '1',
        optionD: '0',
        answerKey: 'A',
        solution: 'Ta có $y = (x-1)^2 + 4 \\ge 4$. Đạt được khi $x = 1$. Vậy giá trị nhỏ nhất là 4.'
      },
      {
        stt: 4,
        lessonId: 1,
        type: 'TRUE_FALSE' as const,
        level: 'Medium',
        point: 2,
        text: 'Hàm số $y = 2x^2 + 4x + 1$ nghịch biến trên khoảng $(-\\infty; -1)$.',
        answerKey: 'True',
        solution: 'Hàm số có $a = 2 > 0$, tọa độ hoành độ đỉnh là $x = -\\frac{b}{2a} = -1$. Vì $a > 0$ nên hàm số nghịch biến trên $(-\\infty; -1)$ và đồng biến trên $(-1; +\\infty)$. Phát biểu đúng.'
      },
      {
        stt: 5,
        lessonId: 1,
        type: 'SHORT_ANSWER' as const,
        level: 'Hard',
        point: 2,
        text: 'Tìm tung độ giao điểm của đồ thị hàm số $y = x^2 - 3x + 2$ với trục tung $Oy$. (Nhập số nguyên)',
        answerKey: '2',
        solution: 'Giao điểm với trục tung $Oy$ là điểm có hoành độ $x = 0$. Thay $x = 0$ vào phương trình hàm số ta được $y = 2$. Tung độ giao điểm là 2.'
      },
      // Toán học - Phương trình lượng giác (stt = 2)
      {
        stt: 6,
        lessonId: 2,
        type: 'CHOOSE_ONE' as const,
        level: 'Easy',
        point: 2,
        text: 'Nghiệm của phương trình lượng giác $\\sin x = 0$ là:',
        optionA: '$x = k\\pi$ ($k \\in \\mathbb{Z}$)',
        optionB: '$x = \\frac{\\pi}{2} + k\\pi$ ($k \\in \\mathbb{Z}$)',
        optionC: '$x = k2\\pi$ ($k \\in \\mathbb{Z}$)',
        optionD: '$x = \\frac{\\pi}{2} + k2\\pi$ ($k \\in \\mathbb{Z}$)',
        answerKey: 'A',
        solution: 'Phương trình $\\sin x = 0 \\Leftrightarrow x = k\\pi$ ($k \\in \\mathbb{Z}$).'
      },
      {
        stt: 7,
        lessonId: 2,
        type: 'CHOOSE_ONE' as const,
        level: 'Medium',
        point: 2,
        text: 'Tìm tất cả các nghiệm của phương trình $\\cos x = \\frac{1}{2}$:',
        optionA: '$x = \\pm \\frac{\\pi}{3} + k2\\pi$ ($k \\in \\mathbb{Z}$)',
        optionB: '$x = \\pm \\frac{\\pi}{6} + k2\\pi$ ($k \\in \\mathbb{Z}$)',
        optionC: '$x = \\pm \\frac{2\\pi}{3} + k2\\pi$ ($k \\in \\mathbb{Z}$)',
        optionD: '$x = \\pm \\frac{\\pi}{3} + k\\pi$ ($k \\in \\mathbb{Z}$)',
        answerKey: 'A',
        solution: 'Ta có $\\cos \\frac{\\pi}{3} = \\frac{1}{2}$ nên $\\cos x = \\cos \\frac{\\pi}{3} \\Leftrightarrow x = \\pm \\frac{\\pi}{3} + k2\\pi$ ($k \\in \\mathbb{Z}$).'
      },
      {
        stt: 8,
        lessonId: 2,
        type: 'CHOOSE_MULTIPLE' as const,
        level: 'Medium',
        point: 2,
        text: 'Những giá trị nào của $x$ sau đây là nghiệm của phương trình $\\tan x = 1$? (Chọn tất cả các đáp án đúng)',
        optionA: '$\\frac{\\pi}{4}$',
        optionB: '$\\frac{5\\pi}{4}$',
        optionC: '$\\frac{3\\pi}{4}$',
        optionD: '$-\\frac{3\\pi}{4}$',
        answerKey: 'A, B, D',
        solution: '$\\tan x = 1 \\Leftrightarrow x = \\frac{\\pi}{4} + k\\pi$. Với $k=0 \\Rightarrow x=\\frac{\\pi}{4}$, với $k=1 \\Rightarrow x=\\frac{5\\pi}{4}$, với $k=-1 \\Rightarrow x=-\\frac{3\\pi}{4}$. Do đó A, B, D đều đúng.'
      },
      {
        stt: 9,
        lessonId: 2,
        type: 'TRUE_FALSE' as const,
        level: 'Easy',
        point: 2,
        text: 'Phương trình $\\sin x = 2$ có nghiệm.',
        answerKey: 'False',
        solution: 'Tập giá trị của hàm số sin là $[-1, 1]$. Vì $2 \\notin [-1, 1]$ nên phương trình $\\sin x = 2$ vô nghiệm. Phát biểu sai.'
      },
      {
        stt: 10,
        lessonId: 2,
        type: 'SHORT_ANSWER' as const,
        level: 'Hard',
        point: 2,
        text: 'Giải phương trình $\\cos x = -1$. Tìm nghiệm thuộc khoảng $(0, 2\\pi)$ dưới dạng chữ cái và ký hiệu (ví dụ: pi)',
        answerKey: 'pi',
        solution: '$\\cos x = -1 \\Leftrightarrow x = \\pi + k2\\pi$. Nghiệm duy nhất thuộc $(0, 2\\pi)$ là $x = \\pi$ (nhập: pi).'
      }
    ],
    results: [] as any[],
    maintenance: false,
    allClasses: ['10A1', '10A2', '10A3'],
    students: [
      { account: 'hoc_sinh', name: 'Nguyễn Văn A', className: '10A1', email: 'anv@edupulse.vn', role: 'student' }
    ]
  };
};

const getLocalDB = () => {
  if (typeof window === 'undefined') return getInitialMockData();
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) {
    const initial = getInitialMockData();
    localStorage.setItem(LS_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(raw);
  } catch {
    const initial = getInitialMockData();
    localStorage.setItem(LS_KEY, JSON.stringify(initial));
    return initial;
  }
};

const saveLocalDB = (dbData: any) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LS_KEY, JSON.stringify(dbData));
  }
};

export const api = {
  async getData() {
    try {
      const response = await fetch(`${API_URL}?action=init`);
      if (!response.ok) throw new Error('Failed to fetch data from Apps Script');
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const studentsList = (data.students || []).map((u: any) => {
        let accountVal = u.account !== undefined ? u.account : '';
        if (!accountVal) {
          const possibleKeys = [' ', 'account', 'Account', 'Tài khoản'];
          for (const k of possibleKeys) {
            if (u[k] !== undefined && u[k] !== null && String(u[k]).trim() !== '') {
              accountVal = u[k];
              break;
            }
          }
        }
        if (!accountVal) {
          for (const k in u) {
            if (k.trim() === '' && u[k] !== undefined && u[k] !== null && String(u[k]).trim() !== '') {
              accountVal = u[k];
              break;
            }
          }
        }
        return {
          account: safeString(accountVal),
          name: safeString(u.name || u.Name),
          className: cleanGrade(u.className || u.Class),
          email: safeString(u.email || u.Email),
          role: safeString(u.role || u.Role)
        };
      });

      const mappedData = {
        users: (data.users || []).map((u: any) => {
          let accountVal = u.Account !== undefined ? u.Account : '';
          if (!accountVal) {
            const possibleKeys = [' ', 'Account', 'account', 'Tài khoản', 'tai khoan'];
            for (const k of possibleKeys) {
              if (u[k] !== undefined && u[k] !== null && String(u[k]).trim() !== '') {
                accountVal = u[k];
                break;
              }
            }
          }
          if (!accountVal) {
            for (const k in u) {
              if (k.trim() === '' && u[k] !== undefined && u[k] !== null && String(u[k]).trim() !== '') {
                accountVal = u[k];
                break;
              }
            }
          }
          return {
            account: safeString(accountVal),
            name: safeString(u.Name),
            className: cleanGrade(u.Class),
            email: safeString(u.Email),
            progress: safeString(u.Progress || 'OFF') as 'ON' | 'OFF',
            active: safeString(u.Active || 'ON') as 'ON' | 'OFF',
            role: safeString(u.Role),
            subjectTeacher: safeString(u['Subject Teacher']),
            password: safeString(u.Password)
          };
        }),
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
          grade: cleanGrade(r.grade || r.Grade),
          score: cleanScore(r.score || r.Score),
          totalQuestions: safeNumber(r.total_questions || r.Total_questions),
          status: (safeString(r.status || r.Status) as 'Pass' | 'Fail'),
          timeSpent: cleanTimeSpent(r.time_spent || r.Time_spent),
          answers: safeString(r.answers || r.Answers),
          createdDate: safeString(r.created_date || r.Created_date),
          role: safeString(r.role || r.Role)
        })),
        maintenance: data.maintenance && data.maintenance.length > 0 && safeString(data.maintenance[0].Maintenance) === 'ON',
        students: studentsList,
        allClasses: Array.from(new Set([
          ...(data.allClasses || []).map((c: any) => cleanGrade(c)),
          ...studentsList.map(s => s.className)
        ])).filter(Boolean)
      };

      // Sync and store in local storage cache
      saveLocalDB(mappedData);
      return mappedData;
    } catch (error) {
      console.warn('[AI Studio] Remote fetch failed. Falling back to robust local database state.', error);
      const db = getLocalDB();
      return {
        users: db.users,
        subjects: db.subjects,
        lessons: db.lessons,
        questions: db.questions,
        results: db.results,
        maintenance: db.maintenance,
        allClasses: db.allClasses,
        students: db.students
      };
    }
  },

  async login(creds: { account: string; password?: string }) {
    try {
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
    } catch (err) {
      console.warn('[AI Studio] Remote login failed, using local fallback credentials.', err);
      const db = getLocalDB();
      const user = db.users.find((u: any) => 
        String(u.account).trim() === String(creds.account).trim() && 
        String(u.password).trim() === String(creds.password).trim()
      );
      if (user) {
        if (String(user.active || 'ON').toUpperCase() !== 'ON') {
          return { success: false, message: 'Tài khoản đã bị khóa.' };
        }
        return {
          success: true,
          user: {
            account: user.account,
            name: user.name,
            className: user.className,
            email: user.email,
            progress: 'ON',
            active: 'ON',
            role: user.role,
            subjectTeacher: user.subjectTeacher || ''
          }
        };
      }
      return { success: false, message: 'Tài khoản hoặc mật khẩu không chính xác.' };
    }
  },

  async saveItem(sheetName: string, item: any, idKey: string) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'saveItem', sheetName, item, idKey })
      });
      return await res.json();
    } catch (err) {
      console.warn('[AI Studio] Remote saveItem failed, saving locally:', err);
      const db = getLocalDB();
      const key = sheetName.toLowerCase();
      let dbKey: keyof typeof db | null = null;
      if (key.includes('user')) dbKey = 'users';
      else if (key.includes('subject')) dbKey = 'subjects';
      else if (key.includes('lesson')) dbKey = 'lessons';
      else if (key.includes('question')) dbKey = 'questions';
      else if (key.includes('result')) dbKey = 'results';
      
      if (dbKey) {
        const arr = db[dbKey] as any[];
        const idx = arr.findIndex((x: any) => {
          const left = String(x[idKey] !== undefined ? x[idKey] : (x[idKey.toLowerCase()] !== undefined ? x[idKey.toLowerCase()] : '')).trim();
          const right = String(item[idKey] !== undefined ? item[idKey] : '').trim();
          return left === right;
        });
        if (idx > -1) {
          arr[idx] = { ...arr[idx], ...item };
        } else {
          arr.push(item);
        }
        saveLocalDB(db);
        return { success: true };
      }
      return { success: false, message: 'Could not find local collection matching ' + sheetName };
    }
  },

  async deleteItem(sheetName: string, idValue: any, idKey: string) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'deleteItem', sheetName, idValue, idKey })
      });
      return await res.json();
    } catch (err) {
      console.warn('[AI Studio] Remote deleteItem failed, deleting locally:', err);
      const db = getLocalDB();
      const key = sheetName.toLowerCase();
      let dbKey: keyof typeof db | null = null;
      if (key.includes('user')) dbKey = 'users';
      else if (key.includes('subject')) dbKey = 'subjects';
      else if (key.includes('lesson')) dbKey = 'lessons';
      else if (key.includes('question')) dbKey = 'questions';
      else if (key.includes('result')) dbKey = 'results';

      if (dbKey) {
        const arr = db[dbKey] as any[];
        const filtered = arr.filter((x: any) => {
          const itemVal = String(x[idKey] !== undefined ? x[idKey] : (x[idKey.toLowerCase()] !== undefined ? x[idKey.toLowerCase()] : '')).trim();
          return itemVal !== String(idValue).trim();
        });
        db[dbKey] = filtered as any;
        saveLocalDB(db);
        return { success: true };
      }
      return { success: false, message: 'Could not find local collection matching ' + sheetName };
    }
  },

  async submitResult(result: Result) {
    try {
      const res = await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: 'submitResult', result }) 
      });
      return await res.json();
    } catch (err) {
      console.warn('[AI Studio] Remote submitResult failed, saving locally:', err);
      const db = getLocalDB();
      db.results.push(result);
      saveLocalDB(db);
      return { success: true };
    }
  },

  async logout(name: string) {
    try {
      const res = await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: 'logout', name }) 
      });
      return await res.json();
    } catch (err) {
      console.warn('[AI Studio] Remote logout failed:', err);
      return { success: true };
    }
  }
};
