
import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { User, Subject, Lesson, Result, Student, Question, QuestionType } from '../types';
import { api } from '../services/api';
import Analytics from './Analytics';
import RenderLatex from './RenderLatex';
import { formatTextWithMath } from '../utils/mathFormatter';

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

  const [importedLessons, setImportedLessons] = useState<Lesson[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [importedQuestions, setImportedQuestions] = useState<Question[]>([]);
  const [showQuestionImportModal, setShowQuestionImportModal] = useState(false);
  const [isQuestionImporting, setIsQuestionImporting] = useState(false);

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
      const isFilterClassGradeOnly = /^\d+$/.test(filterClass);
      const matchClass = filterClass === 'ALL' || 
        item.className === filterClass || 
        (isFilterClassGradeOnly && extractGradeNumber(item.className).toString() === filterClass);
      const matchSubject = filterSub === 'ALL' || item.subjectName === filterSub;
      const matchLesson = filterLes === 'ALL' || item.lessonName === filterLes;
      const matchStatus = filterStat === 'ALL' || item.status === filterStat;
      return matchClass && matchSubject && matchLesson && matchStatus;
    });
  }, [students, subjects, lessons, results, isAdmin, teacherGrade, filterClass, filterSub, filterLes, filterStat]);

  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedRosterData = useMemo(() => {
    if (!sortField) return rosterData;
    return [...rosterData].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      
      // Specially handle score sorting where -1 is considered lower than actual scores
      if (sortField === 'score') {
        const numA = Number(valA);
        const numB = Number(valB);
        if (numA < numB) return sortDirection === 'asc' ? -1 : 1;
        if (numA > numB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [rosterData, sortField, sortDirection]);

  const [lessonSortField, setLessonSortField] = useState<string | null>(null);
  const [lessonSortDirection, setLessonSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleLessonSort = (field: string) => {
    if (lessonSortField === field) {
      setLessonSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setLessonSortField(field);
      setLessonSortDirection('asc');
    }
  };

  const sortedLessons = useMemo(() => {
    if (!lessonSortField) return visibleLessons;
    return [...visibleLessons].sort((a, b) => {
      let valA: any = a[lessonSortField as keyof Lesson];
      let valB: any = b[lessonSortField as keyof Lesson];

      if (lessonSortField === 'subjectId') {
        const subA = subjects.find(s => s.stt === a.subjectId)?.name || '';
        const subB = subjects.find(s => s.stt === b.subjectId)?.name || '';
        valA = subA;
        valB = subB;
      }

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (valA < valB) return lessonSortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return lessonSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [visibleLessons, lessonSortField, lessonSortDirection, subjects]);

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

  const handleExportExcel = () => {
    try {
      const exportData = visibleLessons.map(l => {
        const subject = subjects.find(s => s.stt === l.subjectId);
        return {
          'STT': l.stt,
          'Tên bài học': l.name,
          'Tiêu đề': l.title || '',
          'Môn học': subject ? `${subject.name} - Khối ${subject.grade}` : '',
          'Mã môn học': l.subjectId,
          'Thời gian làm bài (phút)': l.timeoutMinutes || 30,
          'Số câu hỏi': l.count || 10,
          'Điểm đạt': l.targetScore || 8
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-fit column widths
      const maxLens = exportData.reduce((acc: any, row: any) => {
        Object.keys(row).forEach((key) => {
          const val = String(row[key] || '');
          acc[key] = Math.max(acc[key] || 0, val.length, key.length);
        });
        return acc;
      }, {});
      
      worksheet['!cols'] = Object.keys(maxLens).map((key) => ({
        wch: maxLens[key] + 3
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Danh sách bài học");
      
      XLSX.writeFile(workbook, `Danh_sach_bai_hoc_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Lỗi khi xuất file Excel:", err);
      alert("Xuất file Excel thất bại!");
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

        if (rawData.length === 0) {
          alert("File Excel trống hoặc không đúng định dạng!");
          return;
        }

        const processed: Lesson[] = [];
        let nextStt = Math.max(...lessons.map(l => l.stt), 0) + 1;

        for (const row of rawData) {
          const subVal = row['Mã môn học'] || row['Mã môn'] || row['subjectId'] || row['Subject_id'] || row['SubjectId'] || row['Môn học'] || row['Môn'];
          let finalSubjectId = visibleSubjects[0]?.stt || 1;
          
          if (subVal !== undefined && subVal !== null) {
            const parsedId = parseInt(subVal);
            if (!isNaN(parsedId)) {
              finalSubjectId = parsedId;
            } else {
              const subStr = String(subVal).toLowerCase().trim();
              const matchedSub = subjects.find(s => 
                s.name.toLowerCase().trim() === subStr || 
                s.name.toLowerCase().includes(subStr) ||
                subStr.includes(s.name.toLowerCase())
              );
              if (matchedSub) {
                finalSubjectId = matchedSub.stt;
              }
            }
          }

          const sttVal = parseInt(row['STT'] || row['stt'] || row['Stt'] || row['Số thứ tự']);
          const finalStt = !isNaN(sttVal) ? sttVal : nextStt++;

          const nameVal = row['Tên bài học'] || row['Tên bài'] || row['name'] || row['Name'] || row['Bài học'];
          if (!nameVal) continue;

          const titleVal = row['Tiêu đề'] || row['Mô tả'] || row['title'] || row['Title'] || '';
          
          const timeoutVal = parseInt(row['Thời gian làm bài (phút)'] || row['Thời gian làm bài'] || row['Thời gian'] || row['timeoutMinutes'] || row['Timeout (minute)'] || row['Phút']);
          const countVal = parseInt(row['Số câu hỏi'] || row['Số câu'] || row['count'] || row['Count']);
          const scoreVal = parseInt(row['Điểm đạt'] || row['Điểm tối thiểu'] || row['targetScore'] || row['Target score'] || row['Yêu cầu điểm']);

          processed.push({
            stt: finalStt,
            subjectId: finalSubjectId,
            name: String(nameVal).trim(),
            title: String(titleVal).trim(),
            timeoutMinutes: !isNaN(timeoutVal) ? timeoutVal : 30,
            count: !isNaN(countVal) ? countVal : 10,
            targetScore: !isNaN(scoreVal) ? scoreVal : 8
          });
        }

        if (processed.length === 0) {
          alert("Không tìm thấy dòng bài học hợp lệ nào để import!");
          return;
        }

        setImportedLessons(processed);
        setShowImportModal(true);
      } catch (err) {
        console.error("Lỗi khi đọc file Excel:", err);
        alert("Đọc file Excel thất bại! Hãy chắc chắn file đúng định dạng.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (importedLessons.length === 0) return;
    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of importedLessons) {
      const payload = {
        'Stt': item.stt,
        'Subject_id': item.subjectId,
        'Name': item.name,
        'Title': item.title,
        'Timeout (minute)': item.timeoutMinutes,
        'Count': item.count,
        'Target score': item.targetScore
      };
      try {
        await api.saveItem('Lessons', payload, 'Stt');
        successCount++;
      } catch (err) {
        console.error("Lỗi khi import dòng:", item, err);
        failCount++;
      }
    }

    setIsImporting(false);
    setShowImportModal(false);
    setImportedLessons([]);
    
    if (onRefreshData) {
      onRefreshData();
    }
    
    if (failCount > 0) {
      alert(`Import hoàn tất! Thành công: ${successCount} bài học, Thất bại: ${failCount} bài học.`);
    } else {
      alert(`Import thành công tất cả ${successCount} bài học!`);
    }
  };

  const handleExportQuestionsExcel = () => {
    try {
      const exportData = visibleQuestions.map(q => {
        const lesson = lessons.find(l => l.stt === q.lessonId);
        return {
          'STT': q.stt,
          'Mã bài học': q.lessonId,
          'Tên bài học': lesson ? lesson.name : '',
          'Loại câu hỏi': q.type || 'CHOOSE_ONE',
          'Mức độ': q.level || 'EASY',
          'Điểm': q.point || 1,
          'Nội dung câu hỏi': q.text || '',
          'ID Ảnh': q.imageId || '',
          'Phương án A': q.optionA || '',
          'Phương án B': q.optionB || '',
          'Phương án C': q.optionC || '',
          'Phương án D': q.optionD || '',
          'Đáp án': q.answerKey || '',
          'Giải thích': q.solution || ''
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Auto-fit column widths
      const maxLens = exportData.reduce((acc: any, row: any) => {
        Object.keys(row).forEach((key) => {
          const val = String(row[key] || '');
          acc[key] = Math.max(acc[key] || 0, val.length, key.length);
        });
        return acc;
      }, {});
      
      worksheet['!cols'] = Object.keys(maxLens).map((key) => ({
        wch: maxLens[key] + 3
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Ngân hàng câu hỏi");
      
      XLSX.writeFile(workbook, `Ngan_hang_cau_hoi_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Lỗi khi xuất file Excel câu hỏi:", err);
      alert("Xuất file Excel thất bại!");
    }
  };

  const handleImportQuestionsFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json<any>(worksheet);

        if (rawData.length === 0) {
          alert("File Excel trống hoặc không đúng định dạng!");
          return;
        }

        const processed: Question[] = [];
        let nextStt = Math.max(...questions.map(q => q.stt), 0) + 1;

        for (const row of rawData) {
          const lessonVal = row['Mã bài học'] || row['Mã bài'] || row['lesson_id'] || row['Lesson ID'] || row['lessonId'] || row['Lesson_id'] || row['Bài học'] || row['Tên bài học'];
          let finalLessonId = visibleLessons[0]?.stt || 1;
          
          if (lessonVal !== undefined && lessonVal !== null) {
            const parsedId = parseInt(lessonVal);
            if (!isNaN(parsedId)) {
              finalLessonId = parsedId;
            } else {
              const lesStr = String(lessonVal).toLowerCase().trim();
              const matchedLes = lessons.find(l => 
                l.name.toLowerCase().trim() === lesStr || 
                l.name.toLowerCase().includes(lesStr) ||
                lesStr.includes(l.name.toLowerCase())
              );
              if (matchedLes) {
                finalLessonId = matchedLes.stt;
              }
            }
          }

          const sttVal = parseInt(row['STT'] || row['stt'] || row['Stt'] || row['Số thứ tự']);
          const finalStt = !isNaN(sttVal) ? sttVal : nextStt++;

          const textVal = row['Nội dung câu hỏi'] || row['Nội dung'] || row['Câu hỏi'] || row['question_text'] || row['Question Text'] || row['text'] || row['Text'];
          if (!textVal) continue;

          const typeVal = String(row['Loại câu hỏi'] || row['Loại'] || row['question_type'] || row['Question Type'] || row['type'] || row['Type'] || 'CHOOSE_ONE').toUpperCase().trim();
          let finalType: QuestionType = 'CHOOSE_ONE';
          if (typeVal.includes('CHOOSE_MULTIPLE') || typeVal.includes('Nhiều') || typeVal.includes('MULTIPLE')) {
            finalType = 'CHOOSE_MULTIPLE';
          } else if (typeVal.includes('TRUE_FALSE') || typeVal.includes('Đúng') || typeVal.includes('Sai')) {
            finalType = 'TRUE_FALSE';
          } else if (typeVal.includes('SHORT_ANSWER') || typeVal.includes('Tự luận') || typeVal.includes('Điền')) {
            finalType = 'SHORT_ANSWER';
          }

          const levelVal = String(row['Mức độ'] || row['Cấp độ'] || row['quiz_level'] || row['level'] || '').trim().toUpperCase();
          let finalLevel = 'EASY';
          if (levelVal === 'EASY' || levelVal === 'MEDIUM' || levelVal === 'HARD') {
            finalLevel = levelVal;
          }

          const pointVal = parseFloat(row['Điểm'] || row['point'] || row['Point'] || row['Số điểm']);
          const finalPoint = !isNaN(pointVal) ? pointVal : 1;

          const imageIdVal = row['ID Ảnh'] || row['Mã ảnh'] || row['image_id'] || row['Image ID'] || row['imageId'] || '';
          const optAVal = row['Phương án A'] || row['Đáp án A'] || row['Option A'] || row['option_A'] || row['optionA'] || '';
          const optBVal = row['Phương án B'] || row['Đáp án B'] || row['Option B'] || row['option_B'] || row['optionB'] || '';
          const optCVal = row['Phương án C'] || row['Đáp án C'] || row['Option C'] || row['option_C'] || row['optionC'] || '';
          const optDVal = row['Phương án D'] || row['Đáp án D'] || row['Option D'] || row['option_D'] || row['optionD'] || '';

          const answerVal = String(row['Đáp án'] || row['Đáp án đúng'] || row['answer_key'] || row['Answer Key'] || row['answerKey'] || '').trim();
          const solutionVal = row['Giải thích'] || row['Lời giải'] || row['solution'] || row['Explanation'] || '';

          processed.push({
            stt: finalStt,
            lessonId: finalLessonId,
            type: finalType,
            level: finalLevel,
            point: finalPoint,
            text: String(textVal).trim(),
            imageId: imageIdVal ? String(imageIdVal).trim() : undefined,
            optionA: optAVal ? String(optAVal).trim() : undefined,
            optionB: optBVal ? String(optBVal).trim() : undefined,
            optionC: optCVal ? String(optCVal).trim() : undefined,
            optionD: optDVal ? String(optDVal).trim() : undefined,
            answerKey: answerVal,
            solution: String(solutionVal).trim()
          });
        }

        if (processed.length === 0) {
          alert("Không tìm thấy câu hỏi hợp lệ nào để import!");
          return;
        }

        setImportedQuestions(processed);
        setShowQuestionImportModal(true);
      } catch (err) {
        console.error("Lỗi khi đọc file Excel câu hỏi:", err);
        alert("Đọc file Excel thất bại! Hãy chắc chắn file đúng định dạng.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleConfirmQuestionsImport = async () => {
    if (importedQuestions.length === 0) return;
    setIsQuestionImporting(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of importedQuestions) {
      const payload = {
        'stt': item.stt,
        'lesson_id': item.lessonId,
        'question_type': item.type,
        'quiz_level': item.level,
        'point': item.point,
        'question_text': item.text,
        'image_id': item.imageId || '',
        'option_A': item.optionA || '',
        'option_B': item.optionB || '',
        'option_C': item.optionC || '',
        'option_D': item.optionD || '',
        'answer_key': item.answerKey,
        'solution': item.solution
      };
      try {
        await api.saveItem('Questions', payload, 'stt');
        successCount++;
      } catch (err) {
        console.error("Lỗi khi import dòng câu hỏi:", item, err);
        failCount++;
      }
    }

    setIsQuestionImporting(false);
    setShowQuestionImportModal(false);
    setImportedQuestions([]);
    
    if (onRefreshData) {
      onRefreshData();
    }
    
    if (failCount > 0) {
      alert(`Import hoàn tất! Thành công: ${successCount} câu hỏi, Thất bại: ${failCount} câu hỏi.`);
    } else {
      alert(`Import thành công tất cả ${successCount} câu hỏi!`);
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
                  <div className="flex justify-between items-center">
                    <div>
                      <h1 className="text-2xl font-black text-gray-800">Bảng điểm danh</h1>
                      <p className="text-gray-500 text-xs">Theo dõi điểm số và tiến độ học tập của các em học sinh.</p>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl shadow-sm border grid grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-1">Lớp học</label>
                      <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-xs outline-none"><option value="ALL">Tất cả lớp</option>{allClasses.map(c => <option key={c} value={c}>Lớp {c}</option>)}</select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-1">Môn học</label>
                      <select value={filterSub} onChange={e => setFilterSub(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-xs outline-none" disabled={isTeacher}><option value="ALL">Tất cả môn</option>{Array.from(new Set(subjects.map(s => s.name))).map(n => <option key={n} value={n}>{n}</option>)}</select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-1">Bài luyện tập</label>
                      <select value={filterLes} onChange={e => setFilterLes(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-xs outline-none"><option value="ALL">Tất cả bài</option>{Array.from(new Set(lessons.map(l => l.name))).map(n => <option key={n} value={n}>{n}</option>)}</select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block pl-1">Trạng thái</label>
                      <select value={filterStat} onChange={e => setFilterStat(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-xs outline-none"><option value="ALL">Tất cả trạng thái</option><option value="Pass">Đạt</option><option value="Fail">Fail</option><option value="Chưa thi">Chưa thi</option></select>
                    </div>
                  </div>
                  <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b select-none">
                        <tr>
                          <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('className')}>
                            <div className="flex items-center gap-1.5 font-black uppercase text-gray-500 tracking-wider">
                              Lớp
                              {sortField === 'className' ? (
                                <i className={`fas ${sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} text-green-600 text-sm`} />
                              ) : (
                                <i className="fas fa-sort text-gray-300 hover:text-gray-400" />
                              )}
                            </div>
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('name')}>
                            <div className="flex items-center gap-1.5 font-black uppercase text-gray-500 tracking-wider">
                              Học sinh
                              {sortField === 'name' ? (
                                <i className={`fas ${sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} text-green-600 text-sm`} />
                              ) : (
                                <i className="fas fa-sort text-gray-300 hover:text-gray-400" />
                              )}
                            </div>
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('lessonName')}>
                            <div className="flex items-center gap-1.5 font-black uppercase text-gray-500 tracking-wider">
                              Bài học
                              {sortField === 'lessonName' ? (
                                <i className={`fas ${sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} text-green-600 text-sm`} />
                              ) : (
                                <i className="fas fa-sort text-gray-300 hover:text-gray-400" />
                              )}
                            </div>
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('score')}>
                            <div className="flex items-center gap-1.5 font-black uppercase text-gray-500 tracking-wider">
                              Điểm
                              {sortField === 'score' ? (
                                <i className={`fas ${sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} text-green-600 text-sm`} />
                              ) : (
                                <i className="fas fa-sort text-gray-300 hover:text-gray-400" />
                              )}
                            </div>
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('status')}>
                            <div className="flex items-center gap-1.5 font-black uppercase text-gray-500 tracking-wider">
                              Trạng thái
                              {sortField === 'status' ? (
                                <i className={`fas ${sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} text-green-600 text-sm`} />
                              ) : (
                                <i className="fas fa-sort text-gray-300 hover:text-gray-400" />
                              )}
                            </div>
                          </th>
                          <th className="px-6 py-4 text-center font-black uppercase text-gray-500 tracking-wider">Chi tiết</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-bold">
                        {sortedRosterData.map((item, i) => (
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
                  <div className="flex justify-between items-center">
                    <div>
                      <h1 className="text-2xl font-black text-gray-800">Danh sách tài khoản</h1>
                      <p className="text-gray-500 text-xs">Quản lý và cấp quyền các tài khoản người dùng trên hệ thống.</p>
                    </div>
                    <button onClick={() => setEditingItem({ account: '', name: '', className: '', email: '', role: 'Student', active: 'ON', progress: 'OFF', password: '' })} className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold text-xs">+ Thêm User</button>
                  </div>
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
                  <div className="flex justify-between items-center">
                    <div>
                      <h1 className="text-2xl font-black text-gray-800">Bảng lớp môn</h1>
                      <p className="text-gray-500 text-xs">Danh mục môn học khối {teacherGrade}.</p>
                    </div>
                    {isAdmin && <button onClick={() => setEditingItem({ stt: subjects.length + 1, name: '', grade: 12 })} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-xs">+ Thêm Môn học</button>}
                  </div>
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
                  <div className="flex justify-between items-center">
                    <div>
                      <h1 className="text-2xl font-black text-gray-800">Quản lý bài học</h1>
                      <p className="text-gray-500 text-xs">Quản lý các bài học và thiết lập chỉ tiêu đạt theo môn học phụ trách.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="file" 
                        id="lesson-excel-import" 
                        onChange={handleImportFile} 
                        accept=".xlsx,.xls,.csv" 
                        className="hidden" 
                      />
                      <button 
                        onClick={handleExportExcel} 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                        title="Xuất danh sách bài học ra file Excel"
                      >
                        <i className="fas fa-file-excel"></i> Export
                      </button>
                      <button 
                        onClick={() => document.getElementById('lesson-excel-import')?.click()} 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                        title="Nhập danh sách bài học từ file Excel"
                      >
                        <i className="fas fa-file-import"></i> Import
                      </button>
                      <button 
                        onClick={() => setEditingItem({ stt: lessons.length + 1, subjectId: visibleSubjects[0]?.stt || 1, name: '', title: '', timeoutMinutes: 30, count: 10, targetScore: 8 })} 
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        + Thêm Bài học
                      </button>
                    </div>
                  </div>
                  <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b select-none">
                        <tr>
                          <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleLessonSort('name')}>
                            <div className="flex items-center gap-1.5 font-black uppercase text-gray-500 tracking-wider">
                              Tên bài
                              {lessonSortField === 'name' ? (
                                <i className={`fas ${lessonSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} text-green-600 text-sm`} />
                              ) : (
                                <i className="fas fa-sort text-gray-300 hover:text-gray-400" />
                              )}
                            </div>
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleLessonSort('subjectId')}>
                            <div className="flex items-center gap-1.5 font-black uppercase text-gray-500 tracking-wider">
                              Môn học
                              {lessonSortField === 'subjectId' ? (
                                <i className={`fas ${lessonSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} text-green-600 text-sm`} />
                              ) : (
                                <i className="fas fa-sort text-gray-300 hover:text-gray-400" />
                              )}
                            </div>
                          </th>
                          <th className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleLessonSort('targetScore')}>
                            <div className="flex items-center gap-1.5 font-black uppercase text-gray-500 tracking-wider">
                              Yêu cầu
                              {lessonSortField === 'targetScore' ? (
                                <i className={`fas ${lessonSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} text-green-600 text-sm`} />
                              ) : (
                                <i className="fas fa-sort text-gray-300 hover:text-gray-400" />
                              )}
                            </div>
                          </th>
                          <th className="px-6 py-4 text-right font-black uppercase text-gray-500 tracking-wider">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-bold">
                        {sortedLessons.map(l => (
                          <tr key={l.stt} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-gray-800">{l.name}</td>
                            <td className="px-6 py-4 text-blue-600">{subjects.find(s=>s.stt===l.subjectId)?.name}</td>
                            <td className="px-6 py-4 text-gray-700">≥ {l.targetScore}đ / {l.count} câu</td>
                            <td className="px-6 py-4 text-right">
                              <button onClick={() => setEditingItem(l)} className="text-blue-500 hover:text-blue-700 mr-3 transition-colors">
                                <i className="fas fa-edit"></i>
                              </button>
                              <button onClick={() => handleDelete('Lessons', l.stt, 'Stt')} className="text-red-500 hover:text-red-700 transition-colors">
                                <i className="fas fa-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'QUESTIONS' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h1 className="text-2xl font-black text-gray-800">Ngân hàng câu hỏi</h1>
                      <p className="text-gray-500 text-xs">Danh sách câu hỏi ôn luyện trong ngân hàng đề thi.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="file" 
                        id="question-excel-import" 
                        onChange={handleImportQuestionsFile} 
                        accept=".xlsx,.xls,.csv" 
                        className="hidden" 
                      />
                      <button 
                        onClick={handleExportQuestionsExcel} 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                        title="Xuất danh sách câu hỏi ra file Excel"
                      >
                        <i className="fas fa-file-excel"></i> Export
                      </button>
                      <button 
                        onClick={() => document.getElementById('question-excel-import')?.click()} 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                        title="Nhập danh sách câu hỏi từ file Excel"
                      >
                        <i className="fas fa-file-import"></i> Import
                      </button>
                      <button 
                        onClick={() => setEditingItem({ stt: questions.length + 1, lessonId: visibleLessons[0]?.stt || 1, type: 'CHOOSE_ONE', level: 'EASY', point: 1, text: '', answerKey: '', solution: '' })} 
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        + Thêm Câu hỏi
                      </button>
                    </div>
                  </div>
                  <div className="bg-white rounded-3xl shadow-sm border overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 border-b"><tr><th className="px-6 py-4">Câu hỏi</th><th className="px-6 py-4">Bài học</th><th className="px-6 py-4">Loại</th><th className="px-6 py-4 text-right">Thao tác</th></tr></thead>
                      <tbody className="divide-y font-bold">
                        {visibleQuestions.slice(0, 50).map(q => (
                          <tr key={q.stt}><td className="px-6 py-4 truncate max-w-xs">{formatTextWithMath(q.text)}</td><td className="px-6 py-4">{lessons.find(l=>l.stt===q.lessonId)?.name}</td><td className="px-6 py-4 text-[10px]">{q.type}</td><td className="px-6 py-4 text-right"><button onClick={() => setEditingItem(q)} className="text-blue-500 mr-2"><i className="fas fa-edit"></i></button><button onClick={() => handleDelete('Questions', q.stt, 'stt')} className="text-red-500"><i className="fas fa-trash"></i></button></td></tr>
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
                <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase">Mức độ</label><select value={editingItem.level} onChange={e=>setEditingItem({...editingItem, level: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-bold"><option value="EASY">EASY</option><option value="MEDIUM">MEDIUM</option><option value="HARD">HARD</option></select></div>
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
                      <div key={`${question.stt}-${idx}`} className="bg-white border rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Câu {idx + 1}</p>
                            <p className="font-bold text-gray-800 mb-3"><RenderLatex content={question.text || 'Không xác định'} /></p>
                            
                            {question.type === 'CHOOSE_ONE' || question.type === 'TRUE_FALSE' ? (
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                {(question.type === 'TRUE_FALSE' ? ['Đúng', 'Sai'] : ['A', 'B', 'C', 'D']).map(option => {
                                  const optionKey = question.type === 'TRUE_FALSE' ? (option === 'Đúng' ? 'optionA' : 'optionB') : `option${option}` as keyof typeof question;
                                  const optionText = question.type === 'TRUE_FALSE' ? option : question?.[optionKey];
                                  const optionChar = question.type === 'TRUE_FALSE' ? option.charAt(0) : option;
                                  const isSelected = studentAnswer.toUpperCase().includes(optionChar.toUpperCase());
                                  return (
                                    <div key={option} className={`p-2 rounded-lg border-2 text-xs font-bold ${isSelected ? 'bg-blue-100 border-blue-400' : 'bg-gray-50 border-gray-200'}`}>
                                      <span className="font-black">{optionChar}.</span> <RenderLatex content={optionText || ''} />
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
                                      <span className="font-black">{option}.</span> <RenderLatex content={optionText || ''} />
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
                            <p className="text-amber-900"><RenderLatex content={question.solution} /></p>
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

      {showImportModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl p-10 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black mb-2 uppercase">Xem trước danh sách bài học Import</h3>
                <p className="text-sm text-gray-500">Phát hiện {importedLessons.length} bài học từ file Excel. Hãy kiểm tra kỹ trước khi bấm xác nhận lưu.</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl" disabled={isImporting}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
              <p className="text-xs text-blue-800 font-bold">
                💡 <strong>Chú ý:</strong> Nếu số thứ tự (STT) trùng khớp với bài học đã tồn tại, hệ thống sẽ tự động cập nhật bài học đó. Nếu số thứ tự mới, hệ thống sẽ thêm mới.
              </p>
            </div>

            <div className="border rounded-2xl overflow-hidden max-h-[50vh] overflow-y-auto mb-6">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b select-none">
                  <tr>
                    <th className="px-4 py-3 font-black text-gray-500 uppercase tracking-wider">STT</th>
                    <th className="px-4 py-3 font-black text-gray-500 uppercase tracking-wider">Tên bài</th>
                    <th className="px-4 py-3 font-black text-gray-500 uppercase tracking-wider">Tiêu đề / Mô tả</th>
                    <th className="px-4 py-3 font-black text-gray-500 uppercase tracking-wider">Môn học ID</th>
                    <th className="px-4 py-3 font-black text-gray-500 uppercase tracking-wider text-center">Thời gian</th>
                    <th className="px-4 py-3 font-black text-gray-500 uppercase tracking-wider text-center">Số câu</th>
                    <th className="px-4 py-3 font-black text-gray-500 uppercase tracking-wider text-center">Điểm tối thiểu</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-bold">
                  {importedLessons.map((l, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{l.stt}</td>
                      <td className="px-4 py-3 text-gray-800">{l.name}</td>
                      <td className="px-4 py-3 text-gray-500 truncate max-w-xs">{l.title || '--'}</td>
                      <td className="px-4 py-3 text-blue-600">
                        ID: {l.subjectId} ({subjects.find(s => s.stt === l.subjectId)?.name || 'Không tìm thấy'})
                      </td>
                      <td className="px-4 py-3 text-center text-gray-800">{l.timeoutMinutes} phút</td>
                      <td className="px-4 py-3 text-center text-gray-800">{l.count}</td>
                      <td className="px-4 py-3 text-center text-green-600">≥ {l.targetScore}đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowImportModal(false)}
                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                disabled={isImporting}
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmImport}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                disabled={isImporting}
              >
                {isImporting ? (
                  <>
                    <i className="fas fa-spinner animate-spin"></i> Đang lưu ({importedLessons.length} dòng)...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i> Xác nhận Import
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuestionImportModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl p-10 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black mb-2 uppercase">Xem trước danh sách Câu hỏi Import</h3>
                <p className="text-sm text-gray-500">Phát hiện {importedQuestions.length} câu hỏi từ file Excel. Hãy kiểm tra kỹ trước khi bấm xác nhận lưu.</p>
              </div>
              <button onClick={() => setShowQuestionImportModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl" disabled={isQuestionImporting}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
              <p className="text-xs text-blue-800 font-bold">
                💡 <strong>Chú ý:</strong> Nếu số thứ tự (STT) trùng khớp với câu hỏi đã tồn tại, hệ thống sẽ tự động cập nhật câu hỏi đó. Nếu số thứ tự mới, hệ thống sẽ thêm mới.
              </p>
            </div>

            <div className="border rounded-2xl overflow-hidden max-h-[50vh] overflow-y-auto mb-6">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b select-none">
                  <tr>
                    <th className="px-4 py-3 font-black text-gray-500 uppercase tracking-wider">STT</th>
                    <th className="px-4 py-3 font-black text-gray-500 uppercase tracking-wider">Nội dung câu hỏi</th>
                    <th className="px-4 py-3 font-black text-gray-500 uppercase tracking-wider">Bài học</th>
                    <th className="px-4 py-3 font-black text-gray-500 uppercase tracking-wider text-center">Loại</th>
                    <th className="px-4 py-3 font-black text-gray-500 uppercase tracking-wider text-center">Mức độ</th>
                    <th className="px-4 py-3 font-black text-gray-500 uppercase tracking-wider text-center">Điểm</th>
                    <th className="px-4 py-3 font-black text-gray-500 uppercase tracking-wider">Đáp án</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-bold">
                  {importedQuestions.map((q, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{q.stt}</td>
                      <td className="px-4 py-3 text-gray-800 truncate max-w-xs">{q.text}</td>
                      <td className="px-4 py-3 text-blue-600">
                        ID: {q.lessonId} ({lessons.find(l => l.stt === q.lessonId)?.name || 'Không tìm thấy'})
                      </td>
                      <td className="px-4 py-3 text-center text-gray-800">{q.type}</td>
                      <td className="px-4 py-3 text-center text-gray-800">{q.level}</td>
                      <td className="px-4 py-3 text-center text-gray-800">{q.point}</td>
                      <td className="px-4 py-3 text-green-600">{q.answerKey}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowQuestionImportModal(false)}
                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                disabled={isQuestionImporting}
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmQuestionsImport}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                disabled={isQuestionImporting}
              >
                {isQuestionImporting ? (
                  <>
                    <i className="fas fa-spinner animate-spin"></i> Đang lưu ({importedQuestions.length} dòng)...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i> Xác nhận Import
                  </>
                )}
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
