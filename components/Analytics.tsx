
import React, { useState, useMemo, useEffect } from 'react';
import { Result, Subject, Lesson, User } from '../types';

interface AnalyticsProps {
  currentUser: User;
  results: Result[];
  subjects: Subject[];
  lessons: Lesson[];
  allClasses: string[];
  onBack: () => void;
}

const Analytics: React.FC<AnalyticsProps> = ({ currentUser, results, subjects, lessons, allClasses, onBack }) => {
  const isTeacher = currentUser.role?.toLowerCase() === 'teacher';
  const isAdmin = currentUser.role?.toLowerCase() === 'admin';

  // Helper trích xuất số khối từ chuỗi lớp (VD: "12A1" -> 12, "9/1" -> 9)
  const extractGradeNumber = (str: string) => {
    const match = String(str || '').match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  };

  // 1. Lọc dữ liệu thô ban đầu (Data Scope)
  const studentResults = useMemo(() => {
    const teacherClass = currentUser.className?.trim() || '';
    const teacherGradeNum = extractGradeNumber(teacherClass);
    const isSpecificClass = teacherClass !== teacherGradeNum.toString() && teacherClass !== '';

    return results.filter(r => {
      const role = (r.role || 'Student').toLowerCase();
      const isNotStaff = role !== 'teacher' && role !== 'admin';
      
      if (isTeacher) {
        if (isSpecificClass) {
          // Giáo viên lớp cụ thể: Chỉ thấy đúng lớp đó
          return isNotStaff && r.grade?.trim() === teacherClass;
        } else {
          // Giáo viên khối: Thấy tất cả học sinh trong khối (VD: khối 9)
          const studentGradeNum = extractGradeNumber(r.grade);
          return isNotStaff && studentGradeNum === teacherGradeNum;
        }
      }
      return isNotStaff;
    });
  }, [results, isTeacher, currentUser.className]);

  // 2. States cho các bộ lọc
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>(() => {
    if (isTeacher) return extractGradeNumber(currentUser.className).toString();
    return 'ALL';
  });
  
  const [selectedSubClass, setSelectedSubClass] = useState<string>('ALL');
  
  // Tự động gán môn học mặc định cho giáo viên bộ môn
  const [selectedSubject, setSelectedSubject] = useState<string>(() => {
    if (isTeacher && currentUser.subjectTeacher) {
      return currentUser.subjectTeacher;
    }
    return 'ALL';
  });
  
  const [selectedLesson, setSelectedLesson] = useState<string>('ALL');
  
  const [chartStatusFilter, setChartStatusFilter] = useState<'ALL' | 'Pass' | 'Fail'>('ALL');
  const [chartStudentFilter, setChartStudentFilter] = useState<string | null>(null);

  // 3. Tính toán danh sách lớp chi tiết khả dụng
  const availableSubClasses = useMemo(() => {
    const teacherClass = currentUser.className?.trim() || '';
    const teacherGradeNumStr = extractGradeNumber(teacherClass).toString();
    const isSpecificClass = teacherClass !== teacherGradeNumStr && teacherClass !== '';

    let sourceList = (allClasses && allClasses.length > 0) 
      ? allClasses 
      : Array.from(new Set(studentResults.map(r => r.grade.trim())));

    // Lọc theo khối đang chọn trước
    let filtered = sourceList.filter(className => {
        if (selectedClassFilter === 'ALL') return true;
        return extractGradeNumber(className).toString() === selectedClassFilter;
    });

    if (isTeacher) {
      if (isSpecificClass) {
        // Nếu là giáo viên lớp 9/1 -> Chỉ hiển thị 9/1
        filtered = filtered.filter(c => c === teacherClass);
      } else {
        // Nếu là giáo viên khối 9 -> Hiển thị 9/1, 9/2... nhưng bỏ qua mục "9" trùng lặp
        filtered = filtered.filter(c => c !== teacherGradeNumStr);
      }
    }

    return filtered.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [allClasses, studentResults, selectedClassFilter, isTeacher, currentUser.className]);

  // Tự động chọn lớp chi tiết nếu chỉ có 1 lựa chọn (dành cho giáo viên lớp cụ thể)
  useEffect(() => {
    if (isTeacher && availableSubClasses.length === 1 && selectedSubClass === 'ALL') {
       setSelectedSubClass(availableSubClasses[0]);
    }
  }, [availableSubClasses, isTeacher, selectedSubClass]);

  const handleGradeChange = (val: string) => {
    setSelectedClassFilter(val);
    setSelectedSubClass('ALL');
    // Nếu là GV bộ môn, giữ nguyên môn học khi đổi khối (nếu khối đó có môn đó)
    // Nếu không, reset về ALL
    if (!(isTeacher && currentUser.subjectTeacher)) {
      setSelectedSubject('ALL');
    }
    setSelectedLesson('ALL');
    resetChartFilters();
  };

  const uniqueGrades = useMemo(() => {
    const sourceGrades = (allClasses && allClasses.length > 0)
      ? allClasses.map(c => extractGradeNumber(c))
      : studentResults.map(r => extractGradeNumber(r.grade));

    // Fix: Explicitly cast Array.from result to number[] to resolve 'unknown' comparison/arithmetic errors
    return (Array.from(new Set(sourceGrades)) as number[]).filter(g => g > 0).sort((a, b) => a - b);
  }, [allClasses, studentResults]);

  const uniqueSubjects = useMemo(() => {
    let filtered = subjects;
    if (selectedClassFilter !== 'ALL') {
      filtered = subjects.filter(s => s.grade.toString() === selectedClassFilter);
    }
    // Fix: cast to string[] for safety
    return (Array.from(new Set(filtered.map(s => s.name))) as string[]).sort();
  }, [subjects, selectedClassFilter]);

  const uniqueLessons = useMemo(() => {
    const matchingSubjectIds = subjects
      .filter(s => (selectedClassFilter === 'ALL' || s.grade.toString() === selectedClassFilter) && (selectedSubject === 'ALL' || s.name === selectedSubject))
      .map(s => s.stt);
    // Fix: cast to string[] for safety
    return (Array.from(new Set(lessons.filter(l => matchingSubjectIds.includes(l.subjectId)).map(l => l.name))) as string[]).sort();
  }, [lessons, subjects, selectedClassFilter, selectedSubject]);

  const resetChartFilters = () => {
    setChartStatusFilter('ALL');
    setChartStudentFilter(null);
  };

  const baseFilteredResults = useMemo(() => {
    return studentResults.filter(r => {
      const matchGrade = selectedClassFilter === 'ALL' || extractGradeNumber(r.grade).toString() === selectedClassFilter;
      const matchSubClass = selectedSubClass === 'ALL' || r.grade.trim() === selectedSubClass;
      const matchSubject = selectedSubject === 'ALL' || r.subjectName === selectedSubject;
      const matchLesson = selectedLesson === 'ALL' || r.lessonName === selectedLesson;
      return matchGrade && matchSubClass && matchSubject && matchLesson;
    });
  }, [studentResults, selectedClassFilter, selectedSubClass, selectedSubject, selectedLesson]);

  const displayResults = useMemo(() => {
    return baseFilteredResults.filter(r => {
      const matchStatus = chartStatusFilter === 'ALL' || r.status === chartStatusFilter;
      const matchStudent = !chartStudentFilter || r.name === chartStudentFilter;
      return matchStatus && matchStudent;
    });
  }, [baseFilteredResults, chartStatusFilter, chartStudentFilter]);

  const allStudentsBestScores = useMemo(() => {
    const bests: Record<string, number> = {};
    baseFilteredResults.forEach(r => {
      if (!bests[r.name] || r.score > bests[r.name]) bests[r.name] = r.score;
    });
    return Object.entries(bests).map(([name, score]) => ({ name, score })).sort((a, b) => b.score - a.score);
  }, [baseFilteredResults]);

  const topStudents = allStudentsBestScores.slice(0, 5);

  const stats = useMemo(() => {
    const pass = baseFilteredResults.filter(r => r.status === 'Pass').length;
    const fail = baseFilteredResults.filter(r => r.status === 'Fail').length;
    const total = baseFilteredResults.length;
    return { pass, fail, total, passRate: total > 0 ? (pass / total) * 100 : 0 };
  }, [baseFilteredResults]);

  return (
    <div className="min-h-screen bg-slate-50 font-['Quicksand'] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <button onClick={onBack} className="text-blue-600 font-bold mb-2 flex items-center gap-2 hover:underline uppercase text-xs">
              <i className="fas fa-arrow-left"></i> Quay lại
            </button>
            <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
              <i className="fas fa-chart-line text-green-600"></i>
              {isTeacher ? (
                currentUser.className === extractGradeNumber(currentUser.className).toString() 
                ? `Thống kê Khối ${currentUser.className}` 
                : `Thống kê Lớp ${currentUser.className}`
              ) : 'Báo cáo & Phân tích'}
            </h1>
            {isTeacher && currentUser.subjectTeacher && (
              <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">
                <i className="fas fa-user-tie mr-1"></i> Giáo viên phụ trách môn: <span className="text-emerald-600">{currentUser.subjectTeacher}</span>
              </p>
            )}
          </div>
          {(chartStatusFilter !== 'ALL' || chartStudentFilter) && (
            <button onClick={resetChartFilters} className="bg-orange-100 text-orange-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-orange-200 shadow-sm">
              Xóa lọc biểu đồ
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* 1. Khối Lớp */}
          <div className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 ${isTeacher ? 'bg-gray-50/50' : ''}`}>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Khối</label>
            <select 
              value={selectedClassFilter} 
              onChange={(e) => handleGradeChange(e.target.value)} 
              disabled={isTeacher}
              className={`w-full p-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none font-bold text-gray-700 text-sm ${isTeacher ? 'cursor-not-allowed opacity-70' : 'hover:border-green-300 transition-colors'}`}
            >
              <option value="ALL">Tất cả Khối</option>
              {isTeacher ? (
                 <option value={extractGradeNumber(currentUser.className).toString()}>Khối {extractGradeNumber(currentUser.className)}</option>
              ) : (
                uniqueGrades.map(g => <option key={g} value={g}>Khối {g}</option>)
              )}
            </select>
          </div>

          {/* 2. Lớp Chi Tiết */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Lớp chi tiết</label>
            <select 
              value={selectedSubClass} 
              onChange={(e) => { setSelectedSubClass(e.target.value); resetChartFilters(); }}
              className="w-full p-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none font-bold text-gray-700 text-sm hover:border-blue-300 transition-colors"
            >
              {availableSubClasses.length > 1 && <option value="ALL">Tất cả lớp</option>}
              {availableSubClasses.map(c => <option key={c} value={c}>Lớp {c}</option>)}
            </select>
          </div>

          {/* 3. Môn Học */}
          <div className={`bg-white p-4 rounded-2xl shadow-sm border border-gray-100 ${isTeacher && currentUser.subjectTeacher ? 'bg-blue-50/30' : ''}`}>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Môn Học</label>
            <select 
              value={selectedSubject} 
              onChange={(e) => { setSelectedSubject(e.target.value); setSelectedLesson('ALL'); resetChartFilters(); }} 
              disabled={isTeacher && !!currentUser.subjectTeacher}
              className={`w-full p-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none font-bold text-gray-700 text-sm ${isTeacher && currentUser.subjectTeacher ? 'cursor-not-allowed border-blue-200' : 'hover:border-emerald-300 transition-colors'}`}
            >
              {!currentUser.subjectTeacher && <option value="ALL">Tất cả Môn</option>}
              {uniqueSubjects.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {/* 4. Bài Học */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Bài Học</label>
            <select value={selectedLesson} onChange={(e) => { setSelectedLesson(e.target.value); resetChartFilters(); }} className="w-full p-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none font-bold text-gray-700 text-sm hover:border-purple-300 transition-colors">
              <option value="ALL">Tất cả Bài học</option>
              {uniqueLessons.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 text-center">
              <h3 className="text-[10px] font-black text-gray-400 uppercase mb-6 tracking-widest">Tỉ lệ Đạt ({baseFilteredResults.length} bài)</h3>
              {stats.total > 0 ? (
                <div className="relative inline-flex items-center justify-center">
                  <svg width="120" height="120" className="transform -rotate-90">
                    <circle cx="60" cy="60" r="50" fill="transparent" stroke="#fecaca" strokeWidth="12" />
                    <circle cx="60" cy="60" r="50" fill="transparent" stroke="#10b981" strokeWidth="12" strokeDasharray={314} strokeDashoffset={314 - (stats.passRate / 100) * 314} strokeLinecap="round" className="transition-all duration-1000" />
                  </svg>
                  <span className="absolute text-2xl font-black text-gray-800">{Math.round(stats.passRate)}%</span>
                </div>
              ) : <p className="text-gray-400 italic py-10 text-xs">Chưa có dữ liệu thống kê</p>}
              <div className="grid grid-cols-2 gap-2 mt-6">
                <button onClick={() => setChartStatusFilter('Pass')} className={`p-3 rounded-2xl text-xs font-black transition-all ${chartStatusFilter === 'Pass' ? 'bg-green-600 text-white shadow-lg scale-105' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>ĐẠT: {stats.pass}</button>
                <button onClick={() => setChartStatusFilter('Fail')} className={`p-3 rounded-2xl text-xs font-black transition-all ${chartStatusFilter === 'Fail' ? 'bg-red-600 text-white shadow-lg scale-105' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}>FAIL: {stats.fail}</button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h3 className="text-[10px] font-black text-gray-400 uppercase mb-6 tracking-widest">Top 5 Điểm Cao</h3>
              <div className="space-y-3">
                {topStudents.map((s, i) => (
                  <div key={s.name} onClick={() => setChartStudentFilter(chartStudentFilter === s.name ? null : s.name)} className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${chartStudentFilter === s.name ? 'bg-blue-600 text-white shadow-md scale-[1.02]' : 'bg-gray-50 hover:bg-blue-50'}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-yellow-400 text-white' : 'bg-gray-200 text-gray-500'}`}>{i+1}</span>
                    <span className="flex-1 text-xs font-bold truncate">{s.name}</span>
                    <span className="text-xs font-black">{s.score.toFixed(1)}</span>
                  </div>
                ))}
                {topStudents.length === 0 && <p className="text-gray-400 italic text-center py-4 text-xs tracking-tighter">Chưa có xếp hạng học sinh</p>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full min-h-[500px]">
              <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
                <h3 className="font-black text-gray-700 uppercase text-[10px] tracking-[0.2em]">Nhật ký làm bài ({displayResults.length})</h3>
                {(chartStatusFilter !== 'ALL' || chartStudentFilter) && (
                   <span className="text-[9px] bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-black uppercase tracking-wider animate-pulse">Lọc theo biểu đồ</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b bg-gray-50/30">
                      <th className="px-6 py-4 font-black uppercase tracking-tighter">Học sinh / Lớp</th>
                      <th className="px-6 py-4 font-black uppercase tracking-tighter">Bài làm</th>
                      <th className="px-6 py-4 font-black uppercase tracking-tighter text-center">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {displayResults.map(r => (
                      <tr key={r.resultId} className={`transition-colors ${chartStudentFilter === r.name ? 'bg-blue-50/50' : 'hover:bg-gray-50/80'}`}>
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-800">{r.name}</p>
                          <p className="text-[10px] text-blue-500 font-bold uppercase tracking-tight">Lớp {r.grade}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-gray-700 line-clamp-1">{r.lessonName}</p>
                          <p className="text-[10px] text-gray-400">{r.createdDate}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full font-black min-w-[40px] shadow-sm ${r.status === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {r.score.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {displayResults.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-32 text-center">
                          <div className="flex flex-col items-center opacity-20">
                            <i className="fas fa-search text-5xl mb-4"></i>
                            <p className="italic font-bold text-sm">Không tìm thấy dữ liệu phù hợp với bộ lọc</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
