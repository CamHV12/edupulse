
import React, { useState, useEffect } from 'react';
import { Lesson, Question } from '../types';

interface ReviewProps {
  result: {
    score: number;
    total: number;
    answers: Record<number, string>;
    questions: Question[];
    timeSpent: string;
  };
  lesson: Lesson;
  onBack: () => void;
}

declare global {
  interface Window {
    confetti: any;
  }
}

const ResultReview: React.FC<ReviewProps> = ({ result, lesson, onBack }) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'WRONG'>('ALL');
  const [showCelebration, setShowCelebration] = useState(false);
  
  const finalScore = result.total > 0 ? (result.score / result.total) * 10 : 0;
  const targetThreshold = lesson.targetScore || 8;
  const isPass = finalScore >= targetThreshold;

  // Kích hoạt pháo hoa khi đạt điểm mục tiêu
  useEffect(() => {
    if (isPass) {
      setShowCelebration(true);
      
      // Hiệu ứng pháo hoa nhiều đợt
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        // Phun từ 2 bên
        window.confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        window.confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      // Một đợt nổ lớn ở giữa sau 3 giây
      setTimeout(() => {
        window.confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#34d399', '#fbbf24', '#ffffff']
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isPass]);

  const getImageUrl = (idOrUrl: string) => {
    if (!idOrUrl) return '';
    const trimmed = idOrUrl.trim();
    if (trimmed.startsWith('data:image')) return trimmed;
    if (trimmed.includes('drive.google.com')) {
      const match = trimmed.match(/(?:id=|d\/)([\w-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
      }
    }
    if (trimmed.startsWith('http')) return trimmed;
    if (trimmed.length > 15 && !trimmed.includes(' ')) {
      return `https://drive.google.com/thumbnail?id=${trimmed}&sz=w1000`;
    }
    return trimmed;
  };

  const isImageSource = (text: string) => {
    if (!text) return false;
    const trimmed = text.trim();
    const hasImageExt = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(trimmed);
    return trimmed.startsWith('http') || 
           trimmed.startsWith('data:image') || 
           trimmed.includes('drive.google.com') || 
           hasImageExt ||
           (trimmed.length > 20 && !trimmed.includes(' '));
  };

  const checkCorrect = (q: Question, userAnswer: string) => {
    const normalizedUser = (userAnswer || '').toString().split(',').map(s => s.trim().toUpperCase()).filter(Boolean).sort().join(',');
    const normalizedCorrect = (q.answerKey || '').toString().split(',').map(s => s.trim().toUpperCase()).filter(Boolean).sort().join(',');
    return normalizedUser === normalizedCorrect;
  };

  const displayQuestions = activeTab === 'ALL' 
    ? result.questions 
    : result.questions.filter(q => !checkCorrect(q, result.answers[q.stt]));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden">
      
      {/* Màn hình Ăn mừng vui nhộn (Celebration Overlay) */}
      {showCelebration && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-green-600/90 backdrop-blur-md animate-celebrateIn"
          onClick={() => setShowCelebration(false)}
        >
          <div className="text-center p-8 max-w-lg">
            <div className="relative mb-8">
              {/* Dancing Mascot */}
              <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mx-auto shadow-2xl animate-mascotDance relative z-10">
                <i className="fas fa-microscope text-6xl text-green-600"></i>
              </div>
              {/* Decorative circles */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-white/20 rounded-full animate-ping"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-white/10 rounded-full animate-pulse delay-75"></div>
            </div>

            <div className="space-y-4">
              <h2 className="text-white text-5xl font-black italic tracking-tighter animate-bounce">XUẤT SẮC!</h2>
              <div className="bg-white/20 px-6 py-2 rounded-full inline-block border border-white/30">
                <p className="text-white font-bold text-lg">Bạn đã chinh phục bài học này!</p>
              </div>
              <div className="py-4">
                <span className="text-white text-7xl font-black drop-shadow-lg">{finalScore.toFixed(1)}</span>
                <span className="text-white/80 text-2xl font-bold ml-2">Điểm</span>
              </div>
              <button 
                className="mt-8 bg-white text-green-700 px-10 py-4 rounded-2xl font-black text-xl shadow-[0_10px_0_rgb(220,220,220)] hover:shadow-[0_5px_0_rgb(220,220,220)] hover:translate-y-[5px] active:translate-y-[10px] active:shadow-none transition-all uppercase tracking-widest"
                onClick={() => setShowCelebration(false)}
              >
                Tiếp tục thôi!
              </button>
            </div>
            
            <p className="text-white/60 text-xs mt-12 font-bold animate-pulse uppercase tracking-[0.3em]">Bấm vào bất kỳ đâu để xem kết quả chi tiết</p>
          </div>
        </div>
      )}

      {/* Header Result */}
      <div className={`p-8 text-white text-center shadow-lg transition-colors duration-500 relative z-10 ${isPass ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-orange-500 to-red-600'}`}>
        <div className="max-w-4xl mx-auto">
          <div className="inline-block p-4 rounded-3xl bg-white/20 backdrop-blur-md mb-6 border border-white/30 shadow-xl transform hover:scale-110 transition-transform">
            <h1 className="text-4xl md:text-6xl font-black mb-2">{finalScore.toFixed(1)}</h1>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">Thang điểm 10</p>
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {isPass ? (
              <span className="flex items-center justify-center gap-2">
                <i className="fas fa-crown text-yellow-300"></i>
                Tuyệt vời, bạn đã vượt qua!
              </span>
            ) : 'Tiếc quá, cần cố gắng thêm!'}
          </h2>
          <p className="text-sm opacity-90 mb-1">Mục tiêu cần đạt: {targetThreshold.toFixed(1)}đ</p>
          <p className="text-xs opacity-75 mb-6">Đúng {result.score}/{result.total} câu - Thời gian hoàn thành: {result.timeSpent}</p>
          <div className="flex justify-center gap-4">
            <button onClick={onBack} className="bg-white text-gray-800 px-8 py-3 rounded-2xl font-bold shadow-lg hover:bg-gray-100 transition-colors">VỀ TRANG CHỦ</button>
            {isPass && (
              <button 
                onClick={() => {
                   window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                }} 
                className="bg-yellow-400 text-yellow-900 px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-yellow-300 transition-colors"
              >
                <i className="fas fa-magic mr-2"></i> BẮN LẠI PHÁO!
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8 relative z-10">
        <div className="flex items-center justify-between mb-8 sticky top-0 bg-slate-50/90 backdrop-blur-sm py-4 z-10">
          <h3 className="text-xl font-bold text-gray-800">Xem lại bài làm</h3>
          <div className="flex bg-gray-200 p-1 rounded-xl shadow-inner">
            <button onClick={() => setActiveTab('ALL')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'ALL' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>TẤT CẢ</button>
            <button onClick={() => setActiveTab('WRONG')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'WRONG' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}>CÂU SAI</button>
          </div>
        </div>

        <div className="space-y-8">
          {displayQuestions.map((q, idx) => {
            const userAnswer = (result.answers[q.stt] || '').toString().trim();
            const isCorrect = checkCorrect(q, userAnswer);
            
            const renderAnswerContent = (text: string) => {
              if (isImageSource(text)) {
                return (
                  <div className="mt-2 flex justify-center bg-white p-2 border rounded-xl shadow-sm overflow-hidden">
                    <img src={getImageUrl(text)} alt="Answer visual" className="max-h-48 rounded-lg object-contain" />
                  </div>
                );
              }
              return <span className="block mt-1">{text || '(Trống)'}</span>;
            };

            const getOptionText = (key: string) => {
              switch(key.toUpperCase()) {
                case 'A': return q.optionA;
                case 'B': return q.optionB;
                case 'C': return q.optionC;
                case 'D': return q.optionD;
                default: return key;
              }
            };

            return (
              <div key={q.stt} className={`bg-white rounded-3xl p-6 md:p-8 shadow-sm border-2 transition-all ${isCorrect ? 'border-green-100 hover:shadow-green-100 shadow-md' : 'border-red-100 hover:shadow-red-50 shadow-md'}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase">CÂU HỎI {idx + 1}</span>
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-0.5 rounded-full uppercase flex items-center gap-1">
                      <i className="fas fa-star text-[8px]"></i> {q.point} Điểm
                    </span>
                  </div>
                  <span className={`font-bold text-sm px-3 py-1 rounded-full flex items-center gap-1 ${isCorrect ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                    <i className={`fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'}`}></i> {isCorrect ? 'CHÍNH XÁC' : 'CHƯA ĐÚNG'}
                  </span>
                </div>

                <p className="text-lg font-semibold text-gray-800 mb-4">{q.text}</p>
                
                {q.imageId && (
                  <div className="mb-6 rounded-2xl border bg-gray-50 p-3 flex justify-center">
                    <img src={getImageUrl(q.imageId)} alt="Review question" className="max-h-80 rounded-lg object-contain shadow-sm" />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className={`p-5 rounded-2xl border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <p className="text-[10px] font-bold uppercase text-gray-400 mb-2">Đáp án của bạn</p>
                    <div className={`font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                      {userAnswer ? userAnswer.split(',').map(key => {
                        const k = key.trim().toUpperCase();
                        return (
                          <div key={k} className="mb-3 last:mb-0">
                            <span className="text-xs opacity-60 bg-white/50 px-2 py-0.5 rounded">Lựa chọn {k}:</span>
                            {renderAnswerContent(getOptionText(k) || k)}
                          </div>
                        );
                      }) : 'Chưa có câu trả lời'}
                    </div>
                  </div>
                  {!isCorrect && (
                    <div className="p-5 rounded-2xl bg-blue-50 border border-blue-200">
                      <p className="text-[10px] font-bold uppercase text-gray-400 mb-2">Đáp án đúng</p>
                      <div className="font-bold text-blue-700">
                        {q.answerKey.split(',').map(key => {
                          const k = key.trim().toUpperCase();
                          return (
                            <div key={k} className="mb-3 last:mb-0">
                              <span className="text-xs opacity-60 bg-white/50 px-2 py-0.5 rounded">Lựa chọn {k}:</span>
                              {renderAnswerContent(getOptionText(k) || k)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {q.solution && (
                  <div className="mt-4 p-5 rounded-2xl bg-slate-50 border-l-4 border-slate-300">
                    <div className="flex items-center gap-2 mb-2">
                      <i className="fas fa-lightbulb text-slate-400"></i>
                      <p className="text-xs font-bold text-slate-500 uppercase">Giải thích chi tiết</p>
                    </div>
                    <p className="text-sm text-slate-600 italic leading-relaxed whitespace-pre-line">{q.solution}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center pb-12">
          <button onClick={onBack} className="text-gray-500 hover:text-green-600 font-bold transition-colors group">
            <i className="fas fa-arrow-left mr-2 group-hover:-translate-x-1 transition-transform"></i> Quay lại Danh sách bài học
          </button>
        </div>
      </div>

      <style>{`
        @keyframes celebrateIn {
          from { opacity: 0; transform: scale(1.1); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes mascotDance {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
          25% { transform: translateY(-20px) rotate(-10deg) scale(1.1); }
          50% { transform: translateY(0) rotate(0deg) scale(1); }
          75% { transform: translateY(-20px) rotate(10deg) scale(1.1); }
        }
        .animate-celebrateIn {
          animation: celebrateIn 0.5s ease-out forwards;
        }
        .animate-mascotDance {
          animation: mascotDance 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default ResultReview;
