
import React, { useState, useEffect, useCallback } from 'react';
import { Lesson, Question } from '../types';

interface QuizProps {
  lesson: Lesson;
  questions: Question[];
  onFinish: (result: {
    score: number;
    total: number;
    answers: Record<number, string>;
    questions: Question[];
    timeSpent: string;
  }) => Promise<void> | void;
  onCancel: () => void;
}

const Quiz: React.FC<QuizProps> = ({ lesson, questions, onFinish, onCancel }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  
  const [timeLeft, setTimeLeft] = useState(() => {
    if (lesson.timeoutMinutes && lesson.timeoutMinutes > 0) {
      return Math.floor(lesson.timeoutMinutes * 60);
    }
    return questions.length > 0 ? questions.length * 60 : 0;
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  const currentQuestion = questions[currentIdx];

  /**
   * Hàm chuyển đổi link Google Drive sang link ảnh trực tiếp
   */
  const getImageUrl = (idOrUrl: string) => {
    if (!idOrUrl) return '';
    const trimmed = idOrUrl.trim();
    
    // 1. Data URL
    if (trimmed.startsWith('data:image')) return trimmed;
    
    // 2. Google Drive Links
    if (trimmed.includes('drive.google.com')) {
      const match = trimmed.match(/(?:id=|d\/)([\w-]+)/);
      if (match && match[1]) {
        // Thumbnail thường load nhanh và ổn định hơn cho preview
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
      }
    }

    // 3. HTTP Links
    if (trimmed.startsWith('http')) return trimmed;
    
    // 4. Raw ID
    if (trimmed.length > 15 && !trimmed.includes(' ')) {
      return `https://drive.google.com/thumbnail?id=${trimmed}&sz=w1000`;
    }
    
    return trimmed;
  };

  /**
   * Kiểm tra xem văn bản có phải là nguồn ảnh không
   */
  const isImageSource = (text: string) => {
    if (!text) return false;
    const trimmed = text.trim();
    // Các phần mở rộng ảnh phổ biến
    const hasImageExt = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(trimmed);
    return trimmed.startsWith('http') || 
           trimmed.startsWith('data:image') || 
           trimmed.includes('drive.google.com') ||
           hasImageExt ||
           (trimmed.length > 20 && !trimmed.includes(' '));
  };

  const handleFinish = useCallback(async () => {
    if (questions.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    let totalScore = 0;
    questions.forEach((q) => {
      const userAnswer = (answers[q.stt] || '').toString().trim().toUpperCase();
      const correctKey = (q.answerKey || '').toString().trim().toUpperCase();
      
      const normalizedUser = userAnswer.split(',').map(s => s.trim()).filter(Boolean).sort().join(',');
      const normalizedCorrect = correctKey.split(',').map(s => s.trim()).filter(Boolean).sort().join(',');
      
      if (normalizedUser === normalizedCorrect) {
        totalScore += 1;
      }
    });

    const timeSpentMs = Date.now() - startTime;
    const minutes = Math.floor(timeSpentMs / 60000);
    const seconds = Math.floor((timeSpentMs % 60000) / 1000);
    const timeSpentString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    try {
      await onFinish({
        score: totalScore,
        total: questions.length,
        answers,
        questions,
        timeSpent: timeSpentString
      });
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  }, [answers, questions, onFinish, startTime, isSubmitting]);

  useEffect(() => {
    if (questions.length === 0) return;
    if (timeLeft <= 0 && !isSubmitting) {
      handleFinish();
      return;
    }
    const timer = setInterval(() => {
      if (!isSubmitting) setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, handleFinish, questions.length, isSubmitting]);

  const toggleOption = (stt: number, optionKey: string, type: string) => {
    if (isSubmitting) return;
    setAnswers(prev => {
      const currentVal = prev[stt] || '';
      
      if (type === 'CHOOSE_MULTIPLE') {
        const selected = currentVal.split(',').map(s => s.trim()).filter(Boolean);
        if (selected.includes(optionKey)) {
          const newVal = selected.filter(o => o !== optionKey).sort().join(', ');
          return { ...prev, [stt]: newVal };
        } else {
          const newVal = [...selected, optionKey].sort().join(', ');
          return { ...prev, [stt]: newVal };
        }
      } else {
        return { ...prev, [stt]: optionKey };
      }
    });
  };

  const isOptionSelected = (stt: number, optionKey: string) => {
    const currentVal = (answers[stt] || '').toString();
    return currentVal.split(',').map(s => s.trim()).includes(optionKey);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-xl border border-gray-100">
          <div className="w-20 h-20 bg-orange-50 text-orange-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fas fa-exclamation-triangle text-4xl"></i>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Thông báo</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Rất tiếc, bài học <span className="font-bold text-green-600">"{lesson.name}"</span> chưa có câu hỏi nào.
          </p>
          <button onClick={onCancel} className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold shadow-lg">
            QUAY LẠI
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b sticky top-0 z-40 px-4 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => !isSubmitting && setShowConfirm(true)} className="text-gray-400 hover:text-red-500">
            <i className="fas fa-times text-xl"></i>
          </button>
          <div>
            <h1 className="text-sm font-bold text-gray-800">{lesson.name}</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase">Câu {currentIdx + 1} / {questions.length}</p>
          </div>
        </div>
        <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 border-2 ${timeLeft < 60 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-green-50 border-green-100 text-green-600'}`}>
          <i className="fas fa-clock"></i>
          <span className="font-mono font-bold text-lg">{formatTime(timeLeft)}</span>
        </div>
        <button onClick={() => !isSubmitting && setShowConfirm(true)} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold">NỘP BÀI</button>
      </div>

      <div className="w-full h-1.5 bg-gray-200">
        <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}></div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase">
                {currentQuestion.type === 'CHOOSE_ONE' ? 'Chọn 1 đáp án' : 
                 currentQuestion.type === 'CHOOSE_MULTIPLE' ? 'Chọn nhiều đáp án' : 
                 currentQuestion.type === 'TRUE_FALSE' ? 'Đúng/Sai' : 'Tự luận'}
              </span>
              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-1 rounded-full uppercase flex items-center gap-1">
                <i className="fas fa-star text-[8px]"></i> {currentQuestion.point} Điểm
              </span>
            </div>
            
            <h2 className="text-xl md:text-2xl font-semibold text-gray-800 leading-relaxed mb-6">
              {currentQuestion.text}
            </h2>

            {currentQuestion.imageId && (
              <div className="mb-6 rounded-2xl overflow-hidden border bg-gray-50 flex justify-center p-2">
                <img 
                  src={getImageUrl(currentQuestion.imageId)} 
                  alt="Question illustration" 
                  className="max-w-full max-h-[500px] object-contain rounded-lg shadow-sm"
                  onError={(e) => { 
                    (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                  }}
                />
              </div>
            )}

            <div className={`space-y-3 ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}>
              {(currentQuestion.type === 'CHOOSE_ONE' || currentQuestion.type === 'CHOOSE_MULTIPLE') && (
                <div className={`grid gap-4 ${
                  [currentQuestion.optionA, currentQuestion.optionB, currentQuestion.optionC, currentQuestion.optionD]
                  .filter(opt => opt && isImageSource(opt)).length > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                }`}>
                  {[
                    { key: 'A', text: currentQuestion.optionA },
                    { key: 'B', text: currentQuestion.optionB },
                    { key: 'C', text: currentQuestion.optionC },
                    { key: 'D', text: currentQuestion.optionD }
                  ].filter(opt => opt.text).map((opt) => {
                    const selected = isOptionSelected(currentQuestion.stt, opt.key);
                    const isImg = isImageSource(opt.text!);
                    return (
                      <button
                        key={opt.key}
                        onClick={() => toggleOption(currentQuestion.stt, opt.key, currentQuestion.type)}
                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                          selected ? 'bg-green-50 border-green-500 shadow-md ring-2 ring-green-200' : 'bg-gray-50 border-gray-100 hover:border-green-200 shadow-sm'
                        }`}
                      >
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 shrink-0 ${
                          selected ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-400 border-gray-200'
                        }`}>
                          {opt.key}
                        </span>
                        <div className="flex-1 flex justify-center overflow-hidden min-h-[40px]">
                          {isImg ? (
                            <img 
                              src={getImageUrl(opt.text!)} 
                              alt={`Option ${opt.key}`} 
                              className="max-h-48 w-full object-contain rounded-lg bg-white p-1" 
                              onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/200?text=Lỗi+ảnh'; }}
                            />
                          ) : (
                            <span className={`font-medium w-full ${selected ? 'text-green-800' : 'text-gray-700'}`}>
                              {opt.text}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'TRUE_FALSE' && (
                <div className="flex flex-col sm:flex-row gap-4">
                  {['True', 'False'].map((val) => (
                    <button
                      key={val}
                      onClick={() => !isSubmitting && setAnswers(prev => ({ ...prev, [currentQuestion.stt]: val }))}
                      className={`flex-1 p-6 rounded-2xl border-2 font-bold text-lg transition-all flex items-center justify-center gap-3 ${
                        answers[currentQuestion.stt] === val
                          ? val === 'True' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'
                          : 'bg-gray-50 border-gray-100 hover:border-blue-100'
                      }`}
                    >
                      <i className={`fas ${val === 'True' ? 'fa-check-circle' : 'fa-times-circle'} text-2xl`}></i>
                      {val === 'True' ? 'Đúng' : 'Sai'}
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.type === 'SHORT_ANSWER' && (
                <textarea
                  rows={4}
                  disabled={isSubmitting}
                  value={answers[currentQuestion.stt] || ''}
                  onChange={(e) => setAnswers(prev => ({ ...prev, [currentQuestion.stt]: e.target.value }))}
                  className="w-full p-5 rounded-2xl border-2 border-gray-100 focus:border-blue-500 outline-none bg-gray-50 text-lg shadow-inner"
                  placeholder="Nhập câu trả lời của bạn..."
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="bg-white border-t p-4 flex justify-between items-center shadow-lg">
        <button
          onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
          disabled={currentIdx === 0 || isSubmitting}
          className="px-6 py-2.5 rounded-xl font-bold text-gray-500 disabled:opacity-30 hover:bg-gray-100"
        >
          <i className="fas fa-arrow-left"></i> TRƯỚC
        </button>
        <div className="hidden sm:flex gap-1 overflow-x-auto max-w-[50%] scrollbar-hide">
          {questions.map((q, idx) => (
            <button
              key={q.stt}
              onClick={() => !isSubmitting && setCurrentIdx(idx)}
              className={`w-8 h-8 rounded-lg text-xs font-bold shrink-0 transition-all ${
                currentIdx === idx ? 'bg-blue-600 text-white shadow-md' : answers[q.stt] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
        <button 
          onClick={() => currentIdx === questions.length - 1 ? setShowConfirm(true) : setCurrentIdx(prev => prev + 1)} 
          disabled={isSubmitting}
          className={`px-8 py-2.5 rounded-xl font-bold text-white shadow-lg transition-all ${currentIdx === questions.length - 1 ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {currentIdx === questions.length - 1 ? 'NỘP BÀI' : 'TIẾP'} <i className={`fas ${currentIdx === questions.length - 1 ? 'fa-paper-plane' : 'fa-arrow-right'} ml-1`}></i>
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-clipboard-check text-3xl"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Hoàn thành bài tập?</h3>
            <p className="text-gray-500 text-sm mb-6">Bạn đã làm {Object.keys(answers).length}/{questions.length} câu hỏi.</p>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => !isSubmitting && setShowConfirm(false)} 
                disabled={isSubmitting}
                className="py-3.5 rounded-2xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                QUAY LẠI
              </button>
              <button 
                onClick={handleFinish} 
                disabled={isSubmitting}
                className="py-3.5 rounded-2xl font-bold text-white bg-green-600 shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2 disabled:bg-green-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    ĐANG NỘP...
                  </>
                ) : (
                  'NỘP BÀI'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quiz;
