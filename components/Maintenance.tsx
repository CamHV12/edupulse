
import React from 'react';

const Maintenance: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 via-red-500 to-orange-400 animate-pulse"></div>
      
      <div className="max-w-md w-full text-center relative">
        <div className="relative inline-block mb-8">
          <div className="w-32 h-32 bg-orange-100 rounded-full flex items-center justify-center mx-auto shadow-inner relative z-10">
            <i className="fas fa-tools text-5xl text-orange-500 animate-bounce"></i>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-orange-50 rounded-full blur-3xl opacity-60"></div>
        </div>

        <h1 className="text-3xl font-black text-gray-800 mb-4 tracking-tight uppercase">
          Hệ thống đang bảo trì
        </h1>
        
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 relative z-20 overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-orange-50 rounded-bl-full opacity-50"></div>
          
          <p className="text-gray-600 leading-relaxed mb-6 font-medium">
            Chào các bạn học sinh! <span className="text-orange-600 font-bold">EduPulse</span> đang được cập nhật thêm nhiều tính năng mới và dữ liệu bài học thú vị hơn.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-orange-500">
                <i className="fas fa-clock"></i>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Dự kiến hoàn thành</p>
                <p className="text-sm font-bold text-gray-800">Sẽ sớm quay trở lại</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-500">
                <i className="fas fa-info-circle"></i>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Thông tin liên hệ</p>
                <p className="text-sm font-bold text-gray-800">Quản trị viên hệ thống</p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 italic">
              Rất xin lỗi vì sự bất tiện này. Chúc các bạn một ngày học tập vui vẻ!
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-2">
          <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
          <span className="w-2 h-2 bg-orange-400 rounded-full animate-ping"></span>
          <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
        </div>
      </div>
    </div>
  );
};

export default Maintenance;
