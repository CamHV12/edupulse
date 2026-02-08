
import React, { useState, useMemo } from 'react';
import { User, Subject, Lesson, Result, Student, Question, QuestionType } from '../types';
import { api } from '../services/api';
import Analytics from './Analytics';

interface DashboardProps {
  user: User;
  users: User[];
  subjects: Subject[];
  lessons: Lesson[];
  questions: Question[];
  results: Result[];
  students: Student[];
  allClasses: string[];
  onStartQuiz: (lesson: Lesson) => void;
  onLogout: () => void;
  onViewAnalytics?: () => void;
  onRefreshData?: () => void;
}

type ManagementTab = 'ROSTER' | 'ANALYTICS' | 'USERS' | 'SUBJECTS' | 'LESSONS' | 'QUESTIONS';

const Dashboard: React.FC<DashboardProps> = ({ 
  user, users, subjects, lessons, questions, results, students, allClasses, onStartQuiz, onLogout, onViewAnalytics, onRefreshData 
}) => {
  const isTeacher = user.role?.toLowerCase() === 'teacher';
  const isAdmin = user.role?.toLowerCase() === 'admin';
  const isStaff = isTeacher || isAdmin;

  const [activeTab, setActiveTab] = useState<ManagementTab>('ROSTER');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [detailResult, setDetailResult] = useState<any>(null);

  // Helper trích xuất số khối từ chuỗi lớp (VD: "12A1" -> 12)
  const extractGradeNumber = (str: string) => {
    const match = String(str || '').match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  };

  const teacherGrade = useMemo(() => extractGradeNumber(user.className), [user.className]);

  // --- LOGIC LỌC DỮ LIỆU ---
  
  // Môn học hiển thị
  const visibleSubjects = useMemo(() => {
    if (isAdmin) return subjects;
    if (isTeacher) {
      return subjects.filter(s => s.name === user.subjectTeacher && s.grade === teacherGrade);
    }
    return [];
  }, [subjects, isAdmin, isTeacher, user.subjectTeacher, teacherGrade]);

  // Bài học hiển thị
  const visibleLessons = useMemo(() => {
    const subjectIds = visibleSubjects.map(s => s.stt);
    return lessons.filter(l => subjectIds.includes(l.subjectId));
  }, [lessons, visibleSubjects]);

  // Câu hỏi hiển thị
  const visibleQuestions = useMemo(() => {
    const lessonIds = visibleLessons.map(l => l.stt);
    return questions.filter(q => lessonIds.includes(q.lessonId));
  }, [questions, visibleLessons]);

  // Fix: Define visibleUsers to filter the user list based on the logged-in staff's permissions
  const visibleUsers = useMemo(() => {
    if (isAdmin) return users;
    if (isTeacher) {
      // Teachers only see accounts with 'Student' role that are in their assigned grade
      return users.filter(u => 
        u.role?.toLowerCase() === 'student' && 
        extractGradeNumber(u.className) === teacherGrade
      );
    }
    return [];
  }, [users, isAdmin, isTeacher, teacherGrade]);

  // --- LOGIC CHO HỌC SINH ---
  const userGrade = useMemo(() => extractGradeNumber(user.className), [user.className]);
  const studentFilteredSubjects = useMemo(() => subjects.filter(s => s.grade === userGrade), [subjects, userGrade]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  React.useEffect(() => {
    if (!selectedSubject && studentFilteredSubjects.length > 0) {
      setSelectedSubject(studentFilteredSubjects[0]);
    }
  }, [studentFilteredSubjects, selectedSubject]);

  const studentCurrentLessons = useMemo(() => 
    lessons.filter(l => l.subjectId === selectedSubject?.stt),
  [lessons, selectedSubject]);

  // --- LOGIC CHO GIÁO VIÊN (Bảng điểm danh) ---
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterSub, setFilterSub] = useState<string>(() => isTeacher && user.subjectTeacher ? user.subjectTeacher : 'ALL');
  const [filterLes, setFilterLes] = useState<string>('ALL');
  const [filterStat, setFilterStat] = useState<string>('ALL');

  const rosterData = useMemo(() => {
    const teacherGradeStr = teacherGrade.toString();
    const myStudents = isAdmin ? students : students.filter(s => extractGradeNumber(s.className).toString() === teacherGradeStr);
    
    const data: any[] = [];
    myStudents.forEach(student => {
      const studentGradeNum = extractGradeNumber(student.className).toString();
      const relevantSubjectIds = subjects.filter(s => s.grade.toString() === studentGradeNum).map(s => s.stt);
      const relevantLessons = lessons.filter(l => relevantSubjectIds.includes(l.subjectId));
      
      relevantLessons.forEach(lesson => {
        const subject = subjects.find(s => s.stt === lesson.subjectId);
        const studentResults = results.filter(r => r.name === student.name && r.lessonName === lesson.name);
        let bestResult = studentResults.length > 0 ? studentResults.reduce((prev, curr) => (prev.score > curr.score) ? prev : curr) : null;
        data.push({
          className: student.className,
          name: student.name,
          subjectName: subject?.name || '?',
          lessonName: lesson.name,
          score: bestResult ? bestResult.score : -1,
          status: bestResult ? bestResult.status : 'Chưa thi'
        });
      });
    });

    return data.filter(item => {
      const matchClass = filterClass === 'ALL' || item.className === filterClass;
      const matchSubject = filterSub === 'ALL' || item.subjectName === filterSub;
      const matchLesson = filterLes === 'ALL' || item.lessonName === filterLes;
      const matchStatus = filterStat === 'ALL' || item.status === filterStat;
      return matchClass && matchSubject && matchLesson && matchStatus;
    });
  }, [students, subjects, lessons, results, isAdmin, teacherGrade, filterClass, filterSub, filterLes, filterStat]);

  // --- CRUD ACTIONS ---

  const handleSave = async (sheetName: string, item: any, idKey: string) => {
    setIsSaving(true);
    let payload = { ...item };
    
    // Ánh xạ sang cấu trúc cột chính xác của Google Sheets
    if (sheetName === 'Users') {
      payload = { 'Account': item.account, 'Name': item.name, 'Class': item.className, 'Email': item.email || '', 'Role': item.role, 'Active': item.active || 'ON', 'Progress': item.progress || 'OFF', 'Password': item.password || '', 'Subject Teacher': item.subjectTeacher || '' };
    } else if (sheetName === 'Subjects') {
      payload = { 'Stt': item.stt, 'Name': item.name, 'Grade': item.grade };
    } else if (sheetName === 'Lessons') {
      payload = { 'Stt': item.stt, 'Subject_id': item.subjectId, 'Name': item.name, 'Title': item.title, 'Timeout (minute)': item.timeoutMinutes, 'Count': item.count, 'Target score': item.targetScore };
    } else if (sheetName === 'Questions') {
      payload = { 'stt': item.stt, 'lesson_id': item.lessonId, 'question_type': item.type, 'quiz_level': item.level, 'point': item.point, 'question_text': item.text, 'image_id': item.imageId, 'option_A': item.option_A || item.optionA, 'option_B': item.option_B || item.optionB, 'option_C': item.option_C || item.optionC, 'option_D': item.option_D || item.optionD, 'answer_key': item.answer_key || item.answerKey, 'solution': item.solution };
    }
    
    try {
      await api.saveItem(sheetName, payload, idKey);
      setEditingItem(null);
      if (onRefreshData) onRefreshData();
    } catch (e) {
      alert("Lỗi khi lưu dữ liệu!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (sheetName: string, idValue: any, idKey: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa?")) return;
    try {
      await api.deleteItem(sheetName, idValue, idKey);
      if (onRefreshData) onRefreshData();
    } catch (e) {
      alert("Lỗi khi xóa dữ liệu!");
    }
  };

  const handleViewDetail = (item: any) => {
    const result = results.find(r => r.name === item.name && r.lessonName === item.lessonName);
    if (result) {
      setDetailResult({ ...result, studentName: item.name, lessonName: item.lessonName, score: item.score });
    }
  };

  const SidebarItem = ({ id, label, icon }: { id: ManagementTab, label: string, icon: string }) => (
    <button 
      onClick={() => { setActiveTab(id); setEditingItem(null); }}
      className={`w-full flex items-center gap-3 px-6 py-4 transition-all ${
        activeTab === id ? 'bg-green-600 text-white shadow-lg z-10' : 'text-gray-500 hover:bg-green-50'
      }`}
    >
      <i className={`fas ${icon} w-5`}></i>
      <span className="font-bold text-sm tracking-wide">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-green-50 flex font-['Quicksand']">
      {/* Sidebar Staff */}
      {isStaff && (
        <aside className="w-64 bg-white shadow-xl flex flex-col sticky top-0 h-screen z-20">
          <div className="p-8 border-b">
            <div className="flex items-center gap-2 mb-2">
              <i className="fas fa-microscope text-green-600 text-2xl"></i>
              <span className="text-xl font-bold text-gray-800">EduPulse</span>
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Teacher Portal</p>
          </div>
          <div className="flex-1 py-4">
            <SidebarItem id="ROSTER" label="Bảng điểm danh" icon="fa-list-check" />
            <SidebarItem id="ANALYTICS" label="Thống kê" icon="fa-chart-pie" />
            <p className="px-8 text-[10px] font-black text-gray-300 uppercase mt-6 mb-2 tracking-widest">Dữ liệu bài giảng</p>
            <SidebarItem id="SUBJECTS" label="Môn học" icon="fa-book" />
            <SidebarItem id="LESSONS" label="Bài học" icon="fa-graduation-cap" />
            <SidebarItem id="QUESTIONS" label="Câu hỏi" icon="fa-database" />
            <p className="px-8 text-[10px] font-black text-gray-300 uppercase mt-6 mb-2 tracking-widest">Hệ thống</p>
            <SidebarItem id="USERS" label="Người dùng" icon="fa-users-cog" />
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-10 px-8 h-20 flex items-center justify-between border-b shadow-sm">
          <h2 className="font-black text-gray-800 uppercase text-sm tracking-widest">{activeTab}</h2>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-gray-800">{user.name}</p>
              <p className="text-[10px] text-gray-400 font-black uppercase">{user.className} • {user.role}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
              <i className="fas fa-user text-green-600"></i>
            </div>
            <button onClick={onLogout} className="text-gray-400 hover:text-red-500 transition-colors p-2" title="Đăng xuất">
              <i className="fas fa-power-off"></i>
            </button>
          </div>
        </nav>

        <main className="p-8">
          {!isStaff ? (
            /* --- HỌC SINH VIEW --- */
            <>
              <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
                {studentFilteredSubjects.map(s => (
                  <button key={s.stt} onClick={() => setSelectedSubject(s)} className={`px-6 py-3 rounded-2xl font-bold transition-all shadow-sm ${selectedSubject?.stt === s.stt ? 'bg-green-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-green-50'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {studentCurrentLessons.map(l => (
                  <div key={l.stt} onClick={() => onStartQuiz(l)} className="bg-white p-6 rounded-[2.5rem] shadow-sm hover:shadow-lg transition-all cursor-pointer border border-transparent hover:border-green-200 group">
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><i className="fas fa-graduation-cap"></i></div>
                    <h3 className="font-bold text-gray-800 mb-1">{l.name}</h3>
                    <p className="text-xs text-gray-400 line-clamp-2">{l.title}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* --- STAFF VIEWS --- */
            <div className="animate-fadeIn">
              {activeTab === 'ROSTER' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border grid grid-cols-4 gap-4">
                    <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="p-3 bg-gray-50 rounded-xl font-bold text-xs"><option value="ALL">Tất cả lớp</option>{allClasses.map(c => <option key={c} value={c}>Lớp {c}</option>)}</select>
                    <select value={filterSub} onChange={e => setFilterSub(e.target.value)} className="p-3 bg-gray-50 rounded-xl font-bold text-xs" disabled={isTeacher}><option value="ALL">Tất cả môn</option>{Array.from(new Set(subjects.map(s => s.name))).map(n => <option key={n} value={n}>{n}</option>)}</select>
                    <select value={filterLes} onChange={e => setFilterLes(e.target.value)} className="p-3 bg-gray-50 rounded-xl font-bold text-xs"><option value="ALL">Tất cả bài</option>{Array.from(new Set(lessons.map(l => l.name))).map(n => <option key={n} value={n}>{n}</option>)}</select>
                    <select value={filterStat} onChange={e => setFilterStat(e.target.value)} className="p-3 bg-gray-50 rounded-xl font-bold text-xs"><option value="ALL">Trạng thái</option><option value="Pass">Đạt</option><option value="Fail">Fail</option><option value="Chưa thi">Chưa thi</option></select>
                  </div>
                  <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b"><tr><th className="px-6 py-4">Lớp</th><th className="px-6 py-4">Học sinh</th><th className="px-6 py-4">Bài học</th><th className="px-6 py-4">Điểm</th><th className="px-6 py-4">Trạng thái</th><th className="px-6 py-4 text-center">Chi tiết</th></tr></thead>
                      <tbody className="divide-y font-bold">
                        {rosterData.map((item, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-blue-600">{item.className}</td>
                            <td className="px-6 py-4 text-gray-800">{item.name}</td>
                            <td className="px-6 py-4 text-gray-500">{item.lessonName}</td>
                            <td className="px-6 py-4">{item.score === -1 ? '--' : item.score.toFixed(1)}</td>
                            <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-[10px] ${item.status === 'Pass' ? 'bg-green-100 text-green-700' : item.status === 'Fail' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'}`}>{item.status}</span></td>
                            <td className="px-6 py-4 text-center">{item.score !== -1 ? <button onClick={() => handleViewDetail(item)} className="text-blue-600 hover:text-blue-800 font-bold"><i className="fas fa-eye"></i></button> : <span className="text-gray-300">-</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'ANALYTICS' && <Analytics currentUser={user} results={results} subjects={subjects} lessons={lessons} allClasses={allClasses} onBack={() => setActiveTab('ROSTER')} />}

              {activeTab === 'USERS' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center"><p className="text-gray-500 text-xs">Danh sách tài khoản hệ thống.</p><button onClick={() => setEditingItem({ account: '', name: '', className: '', email: '', role: 'Student', active: 'ON', progress: 'OFF', password: '' })} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold text-xs">+ Thêm User</button></div>
                  <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b"><tr><th className="px-6 py-4">Account</th><th className="px-6 py-4">Họ tên</th><th className="px-6 py-4">Lớp</th><th className="px-6 py-4">Role</th><th className="px-6 py-4 text-right">Thao tác</th></tr></thead>
                      <tbody className="divide-y font-bold">
                        {visibleUsers.map(u => (
                          <tr key={u.account}>
                            <td className="px-6 py-4">{u.account}</td>
                            <td className="px-6 py-4">{u.name}</td>
                            <td className="px-6 py-4">{u.className}</td>
                            <td className="px-6 py-4"><span className="bg-slate-100 px-2 py-1 rounded-lg">{u.role}</span></td>
                            <td className="px-6 py-4 text-right"><button onClick={() => setEditingItem(u)} className="text-blue-500 mr-2"><i className="fas fa-edit"></i></button><button onClick={() => handleDelete('Users', u.account, 'Account')} className="text-red-500"><i className="fas fa-trash"></i></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'SUBJECTS' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center"><p className="text-gray-500 text-xs">Danh mục môn học khối {teacherGrade}.</p>{isAdmin && <button onClick={() => setEditingItem({ stt: subjects.length + 1, name: '', grade: 12 })} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-xs">+ Thêm Môn học</button>}</div>
                  <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b"><tr><th className="px-6 py-4">Tên môn học</th><th className="px-6 py-4 text-center">Khối</th>{isAdmin && <th className="px-6 py-4 text-right">Thao tác</th>}</tr></thead>
                      <tbody className="divide-y font-bold">
                        {visibleSubjects.map(s => (
                          <tr key={s.stt}><td className="px-6 py-4">{s.name}</td><td className="px-6 py-4 text-center">Khối {s.grade}</td>{isAdmin && <td className="px-6 py-4 text-right"><button onClick={() => setEditingItem(s)} className="text-blue-500 mr-2"><i className="fas fa-edit"></i></button><button onClick={() => handleDelete('Subjects', s.stt, 'Stt')} className="text-red-500"><i className="fas fa-trash"></i></button></td>}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'LESSONS' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center"><p className="text-gray-500 text-xs">Quản lý bài học theo môn phụ trách.</p><button onClick={() => setEditingItem({ stt: lessons.length + 1, subjectId: visibleSubjects[0]?.stt || 1, name: '', title: '', timeoutMinutes: 30, count: 10, targetScore: 8 })} className="bg-purple-600 text-white px-6 py-2 rounded-xl font-bold text-xs">+ Thêm Bài học</button></div>
                  <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b"><tr><th className="px-6 py-4">Tên bài</th><th className="px-6 py-4">Môn học</th><th className="px-6 py-4">Yêu cầu</th><th className="px-6 py-4 text-right">Thao tác</th></tr></thead>
                      <tbody className="divide-y font-bold">
                        {visibleLessons.map(l => (
                          <tr key={l.stt}><td className="px-6 py-4">{l.name}</td><td className="px-6 py-4">{subjects.find(s=>s.stt===l.subjectId)?.name}</td><td className="px-6 py-4">≥ {l.targetScore}đ / {l.count} câu</td><td className="px-6 py-4 text-right"><button onClick={() => setEditingItem(l)} className="text-blue-500 mr-2"><i className="fas fa-edit"></i></button><button onClick={() => handleDelete('Lessons', l.stt, 'Stt')} className="text-red-500"><i className="fas fa-trash"></i></button></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'QUESTIONS' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center"><p className="text-gray-500 text-xs">Ngân hàng câu hỏi của bạn.</p><button onClick={() => setEditingItem({ stt: questions.length + 1, lessonId: visibleLessons[0]?.stt || 1, type: 'CHOOSE_ONE', level: 'Thông hiểu', point: 1, text: '', answerKey: '', solution: '' })} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold text-xs">+ Thêm Câu hỏi</button></div>
                  <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b"><tr><th className="px-6 py-4">Câu hỏi</th><th className="px-6 py-4">Bài học</th><th className="px-6 py-4">Loại</th><th className="px-6 py-4 text-right">Thao tác</th></tr></thead>
                      <tbody className="divide-y font-bold">
                        {visibleQuestions.slice(0, 50).map(q => (
                          <tr key={q.stt}><td className="px-6 py-4 truncate max-w-xs">{q.text}</td><td className="px-6 py-4">{lessons.find(l=>l.stt===q.lessonId)?.name}</td><td className="px-6 py-4 text-[10px]">{q.type}</td><td className="px-6 py-4 text-right"><button onClick={() => setEditingItem(q)} className="text-blue-500 mr-2"><i className="fas fa-edit"></i></button><button onClick={() => handleDelete('Questions', q.stt, 'stt')} className="text-red-500"><i className="fas fa-trash"></i></button></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODALS */}
      {editingItem && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl p-10 overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-black mb-6 uppercase">Chi tiết thông tin</h3>
            
            {activeTab === 'USERS' && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Account</label><input value={editingItem.account} onChange={e=>setEditingItem({...editingItem, account: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Mật khẩu</label><input type="password" value={editingItem.password} onChange={e=>setEditingItem({...editingItem, password: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold" /></div>
                <div className="col-span-2 space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Họ tên</label><input value={editingItem.name} onChange={e=>setEditingItem({...editingItem, name: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Lớp</label><input value={editingItem.className} onChange={e=>setEditingItem({...editingItem, className: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold" /></div>
                {!editingItem.account && <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Vai trò</label><select value={editingItem.role} onChange={e=>setEditingItem({...editingItem, role: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold"><option value="Student">Học sinh</option><option value="Teacher">Giáo viên</option><option value="Admin">Admin</option></select></div>}
              </div>
            )}

            {activeTab === 'LESSONS' && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Môn học</label><select value={editingItem.subjectId} onChange={e=>setEditingItem({...editingItem, subjectId: parseInt(e.target.value)})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold">{subjects.filter(s => isAdmin || (s.name === user.subjectTeacher && s.grade === teacherGrade)).map(s=><option key={s.stt} value={s.stt}>{s.name} - Khối {s.grade}</option>)}</select></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Tên bài học</label><input value={editingItem.name} onChange={e=>setEditingItem({...editingItem, name: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold" /></div>
                <div className="col-span-2 space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Mô tả ngắn</label><input value={editingItem.title} onChange={e=>setEditingItem({...editingItem, title: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Thời gian (phút)</label><input type="number" value={editingItem.timeoutMinutes} onChange={e=>setEditingItem({...editingItem, timeoutMinutes: parseInt(e.target.value)})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Số câu lấy ra</label><input type="number" value={editingItem.count} onChange={e=>setEditingItem({...editingItem, count: parseInt(e.target.value)})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Điểm đạt (≥)</label><input type="number" step="0.5" value={editingItem.targetScore} onChange={e=>setEditingItem({...editingItem, targetScore: parseFloat(e.target.value)})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold" /></div>
              </div>
            )}

            {activeTab === 'QUESTIONS' && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="col-span-2 space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Bài học</label><select value={editingItem.lessonId} onChange={e=>setEditingItem({...editingItem, lessonId: parseInt(e.target.value)})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold">{visibleLessons.map(l=><option key={l.stt} value={l.stt}>{l.name}</option>)}</select></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Loại câu hỏi</label><select value={editingItem.type} onChange={e=>setEditingItem({...editingItem, type: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold"><option value="CHOOSE_ONE">Chọn một</option><option value="CHOOSE_MULTIPLE">Chọn nhiều</option><option value="TRUE_FALSE">Đúng / Sai</option><option value="SHORT_ANSWER">Tự luận</option></select></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Mức độ</label><select value={editingItem.level} onChange={e=>setEditingItem({...editingItem, level: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold"><option value="Nhận biết">Nhận biết</option><option value="Thông hiểu">Thông hiểu</option><option value="Vận dụng">Vận dụng</option><option value="VD Cao">VD Cao</option></select></div>
                <div className="col-span-2 space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Nội dung câu hỏi</label><textarea value={editingItem.text} onChange={e=>setEditingItem({...editingItem, text: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold h-20" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Option A</label><input value={editingItem.optionA} onChange={e=>setEditingItem({...editingItem, optionA: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg text-xs" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Option B</label><input value={editingItem.optionB} onChange={e=>setEditingItem({...editingItem, optionB: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg text-xs" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Option C</label><input value={editingItem.optionC} onChange={e=>setEditingItem({...editingItem, optionC: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg text-xs" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Option D</label><input value={editingItem.optionD} onChange={e=>setEditingItem({...editingItem, optionD: e.target.value})} className="w-full p-2 bg-gray-50 border rounded-lg text-xs" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Đáp án (VD: A hoặc A,B)</label><input value={editingItem.answerKey} onChange={e=>setEditingItem({...editingItem, answerKey: e.target.value})} className="w-full p-3 bg-green-50 border border-green-200 rounded-xl font-bold" /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">ID Ảnh (nếu có)</label><input value={editingItem.imageId} onChange={e=>setEditingItem({...editingItem, imageId: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold" /></div>
                <div className="col-span-2 space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Giải thích</label><textarea value={editingItem.solution} onChange={e=>setEditingItem({...editingItem, solution: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold h-20" /></div>
              </div>
            )}

            <div className="flex gap-4">
              <button onClick={() => setEditingItem(null)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase tracking-widest">Hủy</button>
              <button onClick={() => handleSave(activeTab.charAt(0) + activeTab.slice(1).toLowerCase(), editingItem, activeTab === 'QUESTIONS' ? 'stt' : 'Stt')} disabled={isSaving} className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg">
                {isSaving ? 'Đang lưu...' : 'Lưu lại'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal for Answer Review */}
      {detailResult && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-3xl p-10 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black mb-2 uppercase">Chi tiết bài làm</h3>
                <p className="text-sm text-gray-600">{detailResult.studentName} - {detailResult.lessonName}</p>
              </div>
              <button onClick={() => setDetailResult(null)} className="text-gray-400 hover:text-gray-600 text-2xl">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-[10px] font-black text-blue-600 uppercase">Điểm số</p>
                <p className="text-2xl font-black text-blue-600">{detailResult.score.toFixed(1)}/10</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-blue-600 uppercase">Tổng câu</p>
                <p className="text-2xl font-black text-blue-600">{detailResult.totalQuestions}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-blue-600 uppercase">Thời gian làm bài</p>
                <p className="text-lg font-black text-blue-600">
                  {(() => {
                    const createdDate = detailResult.createdDate;
                    if (!createdDate) return 'N/A';
                    
                    try {
                      // Parse ISO date string hoặc timestamp
                      const date = new Date(createdDate);
                      if (isNaN(date.getTime())) return 'N/A';
                      
                      // Format: "DD/MM/YYYY HH:mm:ss"
                      const day = String(date.getDate()).padStart(2, '0');
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const year = date.getFullYear();
                      const hours = String(date.getHours()).padStart(2, '0');
                      const minutes = String(date.getMinutes()).padStart(2, '0');
                      const seconds = String(date.getSeconds()).padStart(2, '0');
                      
                      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
                    } catch (e) {
                      return createdDate;
                    }
                  })()}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {(() => {
                try {
                  // Parse answers data
                  let answersData: any = null;
                  if (typeof detailResult.answers === 'string') {
                    try {
                      answersData = JSON.parse(detailResult.answers);
                    } catch (e) {
                      console.error('Error parsing answers JSON:', detailResult.answers, e);
                      return <div className="text-center text-red-400 py-8">Lỗi: Không thể đọc dữ liệu câu trả lời</div>;
                    }
                  } else {
                    answersData = detailResult.answers;
                  }

                  if (!answersData) {
                    return <div className="text-center text-gray-400 py-8">Không có dữ liệu câu trả lời</div>;
                  }

                  // Map answers - hỗ trợ nhiều format khác nhau
                  const answersMap: Map<number, string> = new Map();
                  
                  if (Array.isArray(answersData)) {
                    // Format: [{questionId: 1, answer: "A"}, ...]
                    answersData.forEach((item: any, index: number) => {
                      let qId = item.questionId;
                      let answer = item.answer || item.studentAnswer || '';
                      
                      // Nếu không có questionId, dùng index hoặc stt
                      if (!qId && item.stt) qId = item.stt;
                      if (!qId) qId = index + 1;
                      
                      if (answer) {
                        answersMap.set(qId, answer);
                      }
                    });
                  } else if (typeof answersData === 'object') {
                    // Format: {1: "A", 2: "B"} hoặc {1: {answer: "A"}, ...}
                    Object.entries(answersData).forEach(([key, value]: [string, any]) => {
                      const qId = parseInt(key);
                      let answer = '';
                      
                      if (typeof value === 'string') {
                        answer = value;
                      } else if (typeof value === 'object') {
                        answer = value.answer || value.studentAnswer || '';
                      }
                      
                      if (answer) {
                        answersMap.set(qId, answer);
                      }
                    });
                  }

                  // Lấy tất cả question IDs từ answers
                  const questionIds = Array.from(answersMap.keys());
                  if (questionIds.length === 0) {
                    return <div className="text-center text-gray-400 py-8">Học sinh chưa làm câu hỏi nào</div>;
                  }

                  // Lấy questions từ database
                  const displayedQuestions = questionIds
                    .map(id => questions.find(q => q.stt === id))
                    .filter((q): q is typeof questions[0] => q !== undefined)
                    .sort((a, b) => a.stt - b.stt);

                  if (displayedQuestions.length === 0) {
                    return <div className="text-center text-gray-400 py-8">Không tìm thấy thông tin câu hỏi</div>;
                  }

                  // Hiển thị tất cả câu hỏi
                  return displayedQuestions.map((question, idx) => {
                    const studentAnswer = answersMap.get(question.stt) || '';
                    const correctAnswer = question.answerKey || '';
                    const isCorrect = studentAnswer.toUpperCase().trim() === correctAnswer.toUpperCase().trim();
                    const isAnswered = studentAnswer.length > 0;

                    return (
                      <div key={question.stt} className="bg-white border rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Câu {idx + 1}</p>
                            <p className="font-bold text-gray-800 mb-3">{question.text || 'Không xác định'}</p>
                            
                            {question.type === 'CHOOSE_ONE' || question.type === 'TRUE_FALSE' ? (
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                {(question.type === 'TRUE_FALSE' ? ['Đúng', 'Sai'] : ['A', 'B', 'C', 'D']).map(option => {
                                  const optionKey = question.type === 'TRUE_FALSE' ? (option === 'Đúng' ? 'optionA' : 'optionB') : `option${option}` as keyof typeof question;
                                  const optionText = question.type === 'TRUE_FALSE' ? option : question?.[optionKey];
                                  const optionChar = question.type === 'TRUE_FALSE' ? option.charAt(0) : option;
                                  const isSelected = studentAnswer.toUpperCase().includes(optionChar.toUpperCase());
                                  return (
                                    <div key={option} className={`p-2 rounded-lg border-2 text-xs font-bold ${isSelected ? 'bg-blue-100 border-blue-400' : 'bg-gray-50 border-gray-200'}`}>
                                      <span className="font-black">{optionChar}.</span> {optionText}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : question.type === 'CHOOSE_MULTIPLE' ? (
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                {['A', 'B', 'C', 'D'].map(option => {
                                  const optionKey = `option${option}` as keyof typeof question;
                                  const optionText = question?.[optionKey];
                                  const isSelected = studentAnswer.toUpperCase().includes(option);
                                  return (
                                    <div key={option} className={`p-2 rounded-lg border-2 text-xs font-bold ${isSelected ? 'bg-blue-100 border-blue-400' : 'bg-gray-50 border-gray-200'}`}>
                                      <span className="font-black">{option}.</span> {optionText}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : question.type === 'SHORT_ANSWER' ? (
                              <div className="bg-blue-50 border border-blue-200 p-2 rounded-lg text-xs italic">
                                {studentAnswer || '--'}
                              </div>
                            ) : null}
                          </div>
                          {isAnswered && (
                            <div className={`px-4 py-2 rounded-lg text-xs font-black whitespace-nowrap ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {isCorrect ? '✓ Đúng' : '✗ Sai'}
                            </div>
                          )}
                          {!isAnswered && (
                            <div className="px-4 py-2 rounded-lg text-xs font-black whitespace-nowrap bg-gray-100 text-gray-500">
                              Chưa trả lời
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-3 border-t text-xs">
                          <div>
                            <p className="font-black text-gray-500 uppercase mb-1">Bạn chọn:</p>
                            <p className="font-bold text-blue-600">{studentAnswer || '--'}</p>
                          </div>
                          <div>
                            <p className="font-black text-gray-500 uppercase mb-1">Đáp án đúng:</p>
                            <p className="font-bold text-green-600">{correctAnswer}</p>
                          </div>
                        </div>

                        {question.solution && (
                          <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded text-xs">
                            <p className="font-black text-amber-700 uppercase mb-1">Giải thích:</p>
                            <p className="text-amber-900">{question.solution}</p>
                          </div>
                        )}
                      </div>
                    );
                  });
                } catch (e) {
                  console.error('Error rendering questions:', e);
                  return <div className="text-center text-red-400 py-8">Lỗi khi hiển thị chi tiết câu hỏi: {String(e)}</div>;
                }
              })()}
            </div>

            <div className="mt-6">
              <button onClick={() => setDetailResult(null)} className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition-all">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default Dashboard;
