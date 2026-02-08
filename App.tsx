
import React, { useState, useEffect, useCallback } from 'react';
import { User, Subject, Lesson, Question, Result, AppState } from './types';
import { api } from './services/api';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import TeacherDashboard from './components/TeacherDashboard';
import Quiz from './components/Quiz';
import ResultReview from './components/ResultReview';
import Maintenance from './components/Maintenance';
import Analytics from './components/Analytics';

const App: React.FC = () => {
  const [view, setView] = useState<'LOGIN' | 'DASHBOARD' | 'QUIZ' | 'REVIEW' | 'ANALYTICS'>('LOGIN');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AppState>({
    user: null,
    users: [],
    subjects: [],
    lessons: [],
    questions: [],
    results: [],
    maintenance: false,
    allClasses: [],
    students: []
  });
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [lastQuizResult, setLastQuizResult] = useState<{
    score: number;
    total: number;
    answers: Record<number, string>;
    questions: Question[];
    timeSpent: string;
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const appData = await api.getData();
      setData(prev => ({ ...prev, ...appData }));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogin = async (user: User) => {
    setData(prev => ({ ...prev, user }));
    setView('DASHBOARD');
  };

  const startQuiz = (lesson: Lesson) => {
    const pool = data.questions.filter(q => q.lessonId === lesson.stt);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const finalCount = (lesson.count && lesson.count > 0) ? lesson.count : shuffled.length;
    setActiveLesson(lesson);
    setQuizQuestions(shuffled.slice(0, finalCount));
    setView('QUIZ');
  };

  const finishQuiz = async (result: {
    score: number;
    total: number;
    answers: Record<number, string>;
    questions: Question[];
    timeSpent: string;
  }) => {
    if (!data.user || !activeLesson) return;
    
    const currentSubject = data.subjects.find(s => s.stt === activeLesson.subjectId);
    const finalScore = result.total > 0 ? (result.score / result.total) * 10 : 0;
    const targetThreshold = activeLesson.targetScore || 8;
    
    const resultRecord: Result = {
      resultId: `RES_${Date.now()}`,
      name: data.user.name,
      subjectName: currentSubject ? currentSubject.name : 'Không xác định',
      lessonName: activeLesson.name,
      grade: data.user.className,
      score: finalScore,
      totalQuestions: result.total,
      status: finalScore >= targetThreshold ? 'Pass' : 'Fail',
      timeSpent: result.timeSpent,
      answers: JSON.stringify(result.answers),
      createdDate: new Date().toLocaleString('vi-VN'),
      role: data.user.role
    };

    try {
      await api.submitResult(resultRecord);
      setLastQuizResult(result);
      setData(prev => ({ ...prev, results: [...prev.results, resultRecord] }));
      setView('REVIEW');
    } catch (e) {
      console.error(e);
      setLastQuizResult(result);
      setView('REVIEW');
    }
  };

  const handleLogout = () => {
    if (data.user) api.logout(data.user.name);
    setData(prev => ({ ...prev, user: null }));
    setView('LOGIN');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto"></div>
        <p className="mt-4 text-green-700 font-bold">Đang tải EduPulse...</p>
      </div>
    </div>
  );

  if (data.maintenance) return <Maintenance />;

  const isStaff = data.user?.role?.toLowerCase() === 'teacher' || data.user?.role?.toLowerCase() === 'admin';

  return (
    <div className="min-h-screen">
      {view === 'LOGIN' && <Login onLogin={handleLogin} />}
      {view === 'DASHBOARD' && data.user && (
        isStaff ? (
          <TeacherDashboard 
            user={data.user} 
            users={data.users}
            subjects={data.subjects} 
            lessons={data.lessons} 
            questions={data.questions}
            results={data.results} 
            students={data.students}
            allClasses={data.allClasses}
            onLogout={handleLogout} 
            onRefreshData={fetchData}
          />
        ) : (
          <Dashboard 
            user={data.user} 
            subjects={data.subjects} 
            lessons={data.lessons} 
            results={data.results} 
            onStartQuiz={startQuiz} 
            onLogout={handleLogout} 
          />
        )
      )}
      {view === 'QUIZ' && activeLesson && (
        <Quiz lesson={activeLesson} questions={quizQuestions} onFinish={finishQuiz} onCancel={() => setView('DASHBOARD')} />
      )}
      {view === 'REVIEW' && lastQuizResult && activeLesson && (
        <ResultReview result={lastQuizResult} lesson={activeLesson} onBack={() => setView('DASHBOARD')} />
      )}
      {view === 'ANALYTICS' && data.user && (
        <Analytics currentUser={data.user} results={data.results} subjects={data.subjects} lessons={data.lessons} allClasses={data.allClasses} onBack={() => setView('DASHBOARD')} />
      )}
    </div>
  );
};

export default App;
