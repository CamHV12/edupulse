
import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !password) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await api.login({ account, password });
      
      if (result.success) {
        onLogin(result.user);
      } else {
        setError(result.message || 'Thông tin đăng nhập không chính xác');
      }
    } catch (err) {
      setError('Lỗi kết nối. Vui lòng thử lại sau.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-900 font-['Quicksand']">
      {/* Fullscreen Loading Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-green-900/70 backdrop-blur-md transition-all duration-300">
          <div className="relative">
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center animate-pulse">
              <i className="fas fa-microscope text-5xl text-white animate-bounce"></i>
            </div>
            <div className="absolute -inset-4 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
          </div>
          <p className="mt-8 text-white font-black tracking-[0.4em] uppercase animate-pulse text-sm">
            Đang đăng nhập EduPulse...
          </p>
        </div>
      )}

      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: 'url("https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop")',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white/95 backdrop-blur-sm rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.5)] p-10 relative z-10 border border-white/40 transform transition-all duration-500 hover:shadow-green-500/20">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-green-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl transform -rotate-6 transition-all duration-300 hover:rotate-0 cursor-default">
            <i className="fas fa-microscope text-4xl text-white"></i>
          </div>
          <h1 className="text-4xl font-black text-gray-800 tracking-tight">EduPulse</h1>
          <p className="text-green-600 mt-2 font-bold text-xs uppercase tracking-[0.2em]">Nhịp đập của giáo dục hiện đại</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm border border-red-100 flex items-start gap-3 animate-shake font-bold shadow-sm">
              <i className="fas fa-circle-exclamation text-lg mt-0.5"></i>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Tài khoản (Mã định danh)</label>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400 group-focus-within:text-green-600 transition-colors">
                <i className="fas fa-user-circle"></i>
              </span>
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50/80 border-2 border-gray-100 rounded-2xl focus:bg-white focus:border-green-500 transition-all outline-none text-gray-800 font-bold"
                placeholder="Nhập mã tài khoản của bạn..."
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Mật khẩu</label>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400 group-focus-within:text-green-600 transition-colors">
                <i className="fas fa-key"></i>
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50/80 border-2 border-gray-100 rounded-2xl focus:bg-white focus:border-green-500 transition-all outline-none text-gray-800 font-bold"
                placeholder="••••••••"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-5 rounded-2xl font-black text-white transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 tracking-widest uppercase mt-6 shadow-xl ${
              isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-green-500/40 hover:-translate-y-0.5 active:translate-y-0'
            }`}
          >
            <i className="fas fa-door-open"></i>
            Vào học tập
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-gray-100 flex flex-col items-center">
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Hệ thống học tập thông minh</p>
          <div className="flex gap-8 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
             <i className="fas fa-dna text-xl"></i>
             <i className="fas fa-brain text-xl"></i>
             <i className="fas fa-atom text-xl"></i>
          </div>
        </div>
      </div>

      <style>{`
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
};

export default Login;
