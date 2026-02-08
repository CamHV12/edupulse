
export type QuestionType = 'CHOOSE_ONE' | 'CHOOSE_MULTIPLE' | 'TRUE_FALSE' | 'SHORT_ANSWER';

export interface User {
  account: string;
  name: string;
  className: string;
  email: string;
  progress: 'ON' | 'OFF';
  active: 'ON' | 'OFF';
  role: string;
  subjectTeacher?: string; // Môn học giáo viên phụ trách
  password?: string;
}

export interface Student {
  account: string;
  name: string;
  className: string;
  email: string;
  role: string;
}

export interface Subject {
  stt: number;
  name: string;
  grade: number;
}

export interface Lesson {
  stt: number;
  subjectId: number;
  name: string;
  title: string;
  timeoutMinutes?: number; 
  count?: number; 
  targetScore?: number;
}

export interface Question {
  stt: number;
  lessonId: number;
  type: QuestionType;
  level: string;
  point: number;
  text: string;
  imageId?: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  answerKey: string;
  solution: string;
}

export interface Result {
  resultId: string;
  name: string;
  className?: string;
  subjectName: string;
  lessonName: string;
  grade: string;
  score: number;
  totalQuestions: number;
  status: 'Pass' | 'Fail';
  timeSpent: string;
  answers: string;
  createdDate: string;
  role?: string;
}

export interface AppState {
  user: User | null;
  users: User[]; // Danh sách toàn bộ user để quản lý
  subjects: Subject[];
  lessons: Lesson[];
  questions: Question[];
  results: Result[];
  maintenance: boolean; 
  allClasses: string[];
  students: Student[];
}
