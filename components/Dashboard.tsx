
import React, { useState, useMemo } from 'react';
import { User, Subject, Lesson, Result, Student } from '../types';

interface DashboardProps {
  user: User;
  subjects: Subject[];
  lessons: Lesson[];
  results: Result[];
  students: Student[];
  allClasses: string[];
  onStartQuiz: (lesson: Lesson) => void;
  onLogout: () => void;
  onViewAnalytics?: () => void;
}

type SortKey = 'className' | 'name' | 'subjectName' | 'lessonName' | 'score' | 'status';
type SortOrder = 'asc' | 'desc';

const Dashboard: React.FC<DashboardProps> = ({ 
  user, subjects, lessons, results, students, allClasses, onStartQuiz, onLogout, onViewAnalytics 
}) => {
  const isTeacher = user.role?.toLowerCase() === 'teacher';
  const isAdmin = user.role?.toLowerCase() === 'admin';
  const isStaff = isTeacher || isAdmin;

  // --- LOGIC CHO HỌC SINH (Student View) ---
  const userGrade = useMemo(() => {
    const match = user.className.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }, [user.className]);

  const filteredSubjects = useMemo(() => 
    subjects.filter(s => s.grade === userGrade), 
  [subjects, userGrade]);

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  React.useEffect(() => {
    if (!selectedSubject && filteredSubjects.length > 0) {
      setSelectedSubject(filteredSubjects[0]);
    }
  }, [filteredSubjects, selectedSubject]);

  const currentLessons = useMemo(() => 
    lessons.filter(l => l.subjectId === selectedSubject?.stt),
  [lessons, selectedSubject]);

  // --- LOGIC CHO GIÁO VIÊN (Teacher View) ---
  const [filterClass, setFilterClass] = useState<string>('ALL');
  
  // Khởi tạo môn học mặc định nếu là GV bộ môn
  const [filterSubject, setFilterSubject] = useState<string>(() => {
    if (isTeacher && user.subjectTeacher) return user.subjectTeacher;
    return 'ALL';
  });
  
  const [filterLesson, setFilterLesson] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, order: SortOrder }>({ key: 'className', order: 'asc' });

  // Xác định phạm vi học sinh của giáo viên
  const teacherGradeNum = useMemo(() => {
    const match = user.className.match(/\d+/);
    return match ? match[0] : '';
  }, [user.className]);

  const myStudents = useMemo(() => {
    if (isAdmin) return students;
    if (isTeacher) {
      const isSpecific = user.className.includes('/');
      return students.filter(s => {
        if (isSpecific) return s.className === user.className;
        return s.className.startsWith(teacherGradeNum);
      });
    }
    return [];
  }, [students, isTeacher, isAdmin, user.className, teacherGradeNum]);

  // Danh sách các lớp khả dụng cho GV
  const availableClasses = useMemo(() => {
    const classes = Array.from(new Set(myStudents.map(s => s.className))) as string[];
    return classes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [myStudents]);

  // Danh sách bài học khả dụng dựa trên môn học đang lọc
  const availableLessonsForFilter = useMemo(() => {
    if (filterSubject === 'ALL') {
      return Array.from(new Set(lessons.map(l => l.name))) as string[];
    }
    const matchingSubjectIds = subjects.filter(s => s.name === filterSubject).map(s => s.stt);
    return Array.from(new Set(lessons.filter(l => matchingSubjectIds.includes(l.subjectId)).map(l => l.name))) as string[];
  }, [lessons, subjects, filterSubject]);

  // Dữ liệu bảng cho Giáo viên
  const rosterData = useMemo(() => {
    const data: any[] = [];
    
    myStudents.forEach(student => {
      const studentGradeNum = (student.className.match(/\d+/) || [''])[0];
      const relevantSubjects = subjects.filter(s => s.grade.toString() === studentGradeNum);
      const relevantSubjectIds = relevantSubjects.map(s => s.stt);
      const relevantLessons = lessons.filter(l => relevantSubjectIds.includes(l.subjectId));

      relevantLessons.forEach(lesson => {
        const subject = subjects.find(s => s.stt === lesson.subjectId);
        
        const studentResults = results.filter(r => 
          r.name === student.name && 
          r.lessonName === lesson.name
        );
        
        let bestResult = null;
        if (studentResults.length > 0) {
          bestResult = studentResults.reduce((prev, curr) => (prev.score > curr.score) ? prev : curr);
        }

        const status = bestResult ? bestResult.status : 'Chưa thi';
        const score = bestResult ? bestResult.score : -1;

        data.push({
          className: student.className,
          name: student.name,
          email: student.email,
          subjectName: subject?.name || '?',
          lessonName: lesson.name,
          score: score,
          status: status,
          target: lesson.targetScore || 8
        });
      });
    });

    return data.filter(item => {
      const matchClass = filterClass === 'ALL' || item.className === filterClass;
      const matchSubject = filterSubject === 'ALL' || item.subjectName === filterSubject;
      const matchLesson = filterLesson === 'ALL' || item.lessonName === filterLesson;
      const matchStatus = filterStatus === 'ALL' || item.status === filterStatus;
      return matchClass && matchSubject && matchLesson && matchStatus;
    });
  }, [myStudents, subjects, lessons, results, filterClass, filterSubject, filterLesson, filterStatus]);

  // Sắp xếp dữ liệu
  const sortedRoster = useMemo(() => {
    const sorted = [...rosterData];
    sorted.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      if (typeof valA === 'string') {
        const compare = valA.localeCompare(valB, undefined, { numeric: true });
        return sortConfig.order === 'asc' ? compare : -compare;
      } else {
        return sortConfig.order === 'asc' ? (valA - valB) : (valB - valA);
      }
    });
    return sorted;
  }, [rosterData, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      order: prev.key === key && prev.order === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sendReminderMail = (email: string, name: string, lesson: string) => {
    const subject = encodeURIComponent(`[EduPulse] Nhắc nhở hoàn thành bài tập: ${lesson}`);
    const body = encodeURIComponent(`Chào ${name},\n\nHệ thống ghi nhận bạn chưa hoàn thành hoặc chưa đạt điểm mục tiêu cho bài tập "${lesson}".\n\nBạn hãy dành thời gian vào EduPulse để ôn tập và làm bài nhé!\n\nTrân trọng,\nGiáo viên bộ môn.`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const getSubjectIcon = (subjectName: string = '') => {
    const name = subjectName.toLowerCase();
    if (name.includes('sinh')) return 'fa-dna';
    if (name.includes('vật lý') || name.includes('vật lí')) return 'fa-atom';
    if (name.includes('hóa')) return 'fa-flask-vial';
    if (name.includes('toán')) return 'fa-square-root-variable';
    if (name.includes('văn')) return 'fa-book-open';
    if (name.includes('anh')) return 'fa-language';
    return 'fa-book';
  };

  return (
    <div className="min-h-screen bg-green-50 pb-12 font-['Quicksand']">
      {/* Navbar */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <i className="fas fa-microscope text-green-600 text-2xl"></i>
              <span className="text-xl font-bold text-gray-800">EduPulse</span>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              {isStaff && (
                <button 
                  onClick={onViewAnalytics}
                  className="bg-blue-50 text-blue-700 px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-2 shadow-sm border border-blue-100"
                >
                  <i className="fas fa-chart-pie"></i>
                  <span className="hidden sm:inline">Phân tích chi tiết</span>
                </button>
              )}
              <div className="hidden md:block text-right">
                <p className="text-sm font-bold text-gray-800">{user.name}</p>
                <p className="text-xs text-gray-500">Lớp {user.className} {user.role ? `(${user.role})` : ''}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                <i className="fas fa-user text-green-600"></i>
              </div>
              <button onClick={onLogout} className="text-gray-400 hover:text-red-500 transition-colors p-2" title="Đăng xuất">
                <i className="fas fa-power-off"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 mt-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Chào mừng bạn, {user.name}!</h2>
            <p className="text-gray-600">
              {isStaff ? 'Hệ thống quản lý học tập dành cho Giáo viên.' : `Hệ thống học tập dành cho Khối ${userGrade}.`}
            </p>
            {isTeacher && user.subjectTeacher && (
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                <i className="fas fa-tag mr-1"></i> Giáo viên bộ môn: {user.subjectTeacher}
              </p>
            )}
          </div>
          {isStaff && (
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
               <div className="px-4 border-r border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase">Tổng học sinh</p>
                  <p className="text-lg font-black text-blue-600">{myStudents.length}</p>
               </div>
               <div className="px-4">
                  <p className="text-[10px] font-black text-gray-400 uppercase">Bài nộp mới</p>
                  <p className="text-lg font-black text-green-600">{results.length}</p>
               </div>
            </div>
          )}
        </header>

        {!isStaff ? (
          /* --- VIEW HỌC SINH --- */
          <>
            <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide">
              {filteredSubjects.map(subject => (
                <button
                  key={subject.stt}
                  onClick={() => setSelectedSubject(subject)}
                  className={`px-6 py-3 rounded-2xl whitespace-nowrap font-semibold transition-all shadow-sm flex items-center gap-2 ${
                    selectedSubject?.stt === subject.stt
                      ? 'bg-green-600 text-white transform scale-105 shadow-green-200 shadow-lg'
                      : 'bg-white text-gray-600 hover:bg-green-100'
                  }`}
                >
                  <i className={`fas ${getSubjectIcon(subject.name)}`}></i>
                  {subject.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {selectedSubject && currentLessons.length > 0 ? (
                currentLessons.map((lesson) => {
                  const subjectLessons = lessons.filter(l => l.subjectId === lesson.subjectId).sort((a, b) => a.stt - b.stt);
                  const lessonIdx = subjectLessons.findIndex(l => l.stt === lesson.stt);
                  let status = 'unlocked';
                  if (lessonIdx > 0) {
                    const prevLesson = subjectLessons[lessonIdx - 1];
                    const prevPass = results.some(r => r.name === user.name && r.lessonName === prevLesson.name && r.status === 'Pass');
                    if (!prevPass) status = 'locked';
                  }

                  const bestScoreResult = results.filter(r => r.name === user.name && r.lessonName === lesson.name).sort((a,b) => b.score - a.score)[0];
                  const bestScore = bestScoreResult ? bestScoreResult.score : null;
                  const passed = results.some(r => r.name === user.name && r.lessonName === lesson.name && r.status === 'Pass');
                  const target = lesson.targetScore || 8;

                  return (
                    <div key={lesson.stt} className={`group relative overflow-hidden rounded-[2rem] p-6 transition-all border-2 ${status === 'locked' ? 'bg-gray-100 border-gray-200 opacity-80 cursor-not-allowed' : 'bg-white border-transparent hover:border-green-400 shadow-[0_10px_30px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_rgba(22,163,74,0.15)] hover:-translate-y-2 cursor-pointer'}`} onClick={() => status === 'unlocked' && onStartQuiz(lesson)}>
                      <div className="flex justify-between items-start mb-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12 ${status === 'locked' ? 'bg-gray-200 text-gray-400' : 'bg-green-100 text-green-600'}`}>
                          <i className={`fas ${status === 'locked' ? 'fa-lock' : getSubjectIcon(selectedSubject.name)} text-2xl`}></i>
                        </div>
                        {passed && <div className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-sm uppercase tracking-wider"><i className="fas fa-check-circle"></i> ĐÃ ĐẠT</div>}
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-green-700 transition-colors">{lesson.name}</h3>
                      <p className="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed">{lesson.title}</p>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2.5 py-1 rounded-lg border border-blue-100 uppercase tracking-tighter"><i className="fas fa-list-ol mr-1"></i> {lesson.count || 'Tất cả'} CÂU</span>
                        {lesson.timeoutMinutes && <span className="bg-purple-50 text-purple-600 text-[10px] font-black px-2.5 py-1 rounded-lg border border-purple-100 uppercase tracking-tighter"><i className="fas fa-clock mr-1"></i> {lesson.timeoutMinutes} PHÚT</span>}
                      </div>
                      <div className="mt-4 flex items-center justify-between pt-5 border-t border-gray-100">
                        <div className="flex flex-col">
                          <div className="flex items-baseline gap-1">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Yêu cầu</span>
                            <span className="text-lg font-black text-emerald-600">{target.toFixed(1)}</span>
                            <span className="text-[10px] text-gray-400 font-bold">/10đ</span>
                          </div>
                          {bestScore !== null ? (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] text-gray-400 font-black uppercase">Kết quả:</span>
                              <span className={`text-xs font-black ${bestScore >= target ? 'text-green-600' : 'text-orange-500'}`}>{bestScore.toFixed(1)}đ</span>
                            </div>
                          ) : <span className="text-[10px] text-gray-300 font-bold italic mt-1 uppercase tracking-tighter">Chưa làm bài</span>}
                        </div>
                        {status === 'unlocked' && <div className="bg-green-600 text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg group-hover:bg-green-700 transition-all group-hover:w-28 overflow-hidden group-hover:rounded-xl"><span className="hidden group-hover:block whitespace-nowrap text-xs font-black mr-2 animate-fadeIn">BẮT ĐẦU</span><i className="fas fa-arrow-right text-xs"></i></div>}
                      </div>
                      {status === 'locked' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/10 backdrop-blur-[1px]">
                          <div className="bg-white/95 shadow-xl px-4 py-2 rounded-2xl border border-gray-100 flex items-center gap-2"><i className="fas fa-shield-halved text-gray-400 text-xs"></i><p className="text-[10px] font-black text-gray-500 uppercase tracking-tight">Hoàn thành bài trước để mở</p></div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] shadow-sm border-2 border-dashed border-gray-100">
                  <i className="fas fa-book-open text-5xl text-gray-200 mb-6"></i>
                  <p className="text-gray-500 font-bold text-lg">Dữ liệu bài học đang được cập nhật</p>
                </div>
              )}
            </div>
          </>
        ) : (
          /* --- VIEW GIÁO VIÊN --- */
          <div className="space-y-6">
            {/* Filters Bar */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Lọc theo Lớp</label>
                <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="w-full p-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-gray-700 text-xs outline-none focus:border-green-400">
                  <option value="ALL">Tất cả lớp phụ trách</option>
                  {availableClasses.map(c => <option key={c} value={c}>Lớp {c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Lọc theo Môn</label>
                <select 
                  value={filterSubject} 
                  onChange={e => {setFilterSubject(e.target.value); setFilterLesson('ALL');}} 
                  disabled={isTeacher && !!user.subjectTeacher}
                  className={`w-full p-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-gray-700 text-xs outline-none focus:border-green-400 ${isTeacher && user.subjectTeacher ? 'cursor-not-allowed opacity-70 border-emerald-100 bg-emerald-50/30' : ''}`}
                >
                  {!user.subjectTeacher && <option value="ALL">Tất cả môn học</option>}
                  {Array.from(new Set(subjects.map(s => s.name))).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Lọc theo Bài</label>
                <select value={filterLesson} onChange={e => setFilterLesson(e.target.value)} className="w-full p-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-gray-700 text-xs outline-none focus:border-green-400">
                  <option value="ALL">Tất cả bài học</option>
                  {availableLessonsForFilter.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Trạng thái</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-gray-700 text-xs outline-none focus:border-green-400">
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="Pass">Đạt (Pass)</option>
                  <option value="Fail">Chưa đạt (Fail)</option>
                  <option value="Chưa thi">Chưa thi</option>
                </select>
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50/50 border-b">
                      {[
                        { label: 'Lớp', key: 'className' },
                        { label: 'Học sinh', key: 'name' },
                        { label: 'Môn', key: 'subjectName' },
                        { label: 'Bài học', key: 'lessonName' },
                        { label: 'Điểm cao nhất', key: 'score' },
                        { label: 'Trạng thái', key: 'status' },
                        { label: 'Đánh giá / Hành động', key: '' }
                      ].map((col, i) => (
                        <th key={i} className={`px-6 py-4 font-black uppercase tracking-tighter text-gray-400 ${col.key ? 'cursor-pointer hover:text-green-600' : ''}`} onClick={() => col.key && handleSort(col.key as SortKey)}>
                          <div className="flex items-center gap-2">
                            {col.label}
                            {col.key && sortConfig.key === col.key && (
                              <i className={`fas fa-sort-amount-${sortConfig.order === 'asc' ? 'up' : 'down'} text-[10px]`}></i>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedRoster.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-4 font-bold text-blue-600">{item.className}</td>
                        <td className="px-6 py-4 font-bold text-gray-800">{item.name}</td>
                        <td className="px-6 py-4">
                           <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold text-slate-500 uppercase">{item.subjectName}</span>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-600 truncate max-w-[150px]">{item.lessonName}</td>
                        <td className="px-6 py-4">
                           {item.score === -1 ? (
                             <span className="text-gray-300 italic">--</span>
                           ) : (
                             <span className={`font-black text-sm ${item.score >= item.target ? 'text-green-600' : 'text-orange-500'}`}>
                               {item.score.toFixed(1)}
                             </span>
                           )}
                        </td>
                        <td className="px-6 py-4">
                           <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                             item.status === 'Pass' ? 'bg-green-100 text-green-700' : 
                             item.status === 'Fail' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                           }`}>
                             {item.status}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                           {(item.status === 'Chưa thi' || item.status === 'Fail') ? (
                             <button 
                               onClick={() => sendReminderMail(item.email, item.name, item.lessonName)}
                               className="bg-orange-50 text-orange-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-orange-100 transition-all border border-orange-100 shadow-sm"
                             >
                               <i className="fas fa-paper-plane"></i> Gửi Mail
                             </button>
                           ) : (
                             <span className="text-green-600 font-bold flex items-center gap-1">
                               <i className="fas fa-check-double"></i> Đã hoàn thành
                             </span>
                           )}
                        </td>
                      </tr>
                    ))}
                    {sortedRoster.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-20 text-center text-gray-400 italic">
                           Không tìm thấy dữ liệu học sinh phù hợp.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
