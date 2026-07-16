'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSidebar } from '../layout';
import { 
  UploadCloud, 
  FileText, 
  Play, 
  Activity, 
  CheckCircle2, 
  Clock, 
  BookOpen, 
  ChevronRight,
  TrendingUp,
  Loader2
} from 'lucide-react';

export default function Dashboard() {
  const { audiobooks, uploadFile, uploading } = useSidebar();
  const [isDragActive, setIsDragActive] = useState(false);
  const router = useRouter();

  // Statistics calculations
  const totalBooks = audiobooks.length;
  const completedBooks = audiobooks.filter(b => b.status === 'completed').length;
  const processingBooks = audiobooks.filter(b => b.status !== 'completed' && b.status !== 'failed').length;
  const failedBooks = audiobooks.filter(b => b.status === 'failed').length;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await uploadFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await uploadFile(file);
    }
  };

  const formatJoinedDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
      
      {/* Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-8 md:p-10 shadow-lg border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 w-80 h-80 rounded-full bg-violet-600/5 blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/20">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>AI Voice Synthesis</span>
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Convert PDFs to Immersive Audiobooks
          </h1>
          <p className="text-slate-350 text-base md:text-lg leading-relaxed">
            Upload your documents and listen to them anytime with naturally voiced narration. We support automatic OCR for scanned pages and images.
          </p>
        </div>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center gap-4 transition-colors duration-300">
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Library</p>
            <h3 className="text-2xl font-bold mt-0.5">{totalBooks}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center gap-4 transition-colors duration-300">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Completed</p>
            <h3 className="text-2xl font-bold mt-0.5">{completedBooks}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center gap-4 transition-colors duration-300">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Processing</p>
            <h3 className="text-2xl font-bold mt-0.5">{processingBooks}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex items-center gap-4 transition-colors duration-300">
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Failed Jobs</p>
            <h3 className="text-2xl font-bold mt-0.5">{failedBooks}</h3>
          </div>
        </div>
      </section>

      {/* Main Grid: Upload & Recent files */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upload Zone */}
        <section className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Generate Audiobook</h2>
          
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-3xl p-8 md:p-12 text-center transition-all duration-300 flex flex-col items-center justify-center min-h-[300px] bg-white dark:bg-slate-900
              ${isDragActive 
                ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/10 scale-[1.01]' 
                : 'border-slate-350 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
              }
              ${uploading ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            <div className="p-4 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 mb-4 transition-transform group-hover:scale-110">
              <UploadCloud className="w-10 h-10" />
            </div>
            
            <h3 className="text-lg font-semibold mb-1">Drag and drop your PDF here</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
              Convert any textbook, novel, or article into a voice-synthesized audiobook. Supports files up to 25MB.
            </p>
            
            <label className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-950 font-semibold cursor-pointer shadow-md transition-all active:scale-95 duration-150">
              <span>Choose PDF File</span>
              <input 
                type="file" 
                accept=".pdf"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
            </label>

            {uploading && (
              <div className="absolute inset-0 bg-white/70 dark:bg-slate-950/70 rounded-3xl flex flex-col items-center justify-center gap-3 backdrop-blur-[1px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">Uploading and preparing PDF...</p>
              </div>
            )}
          </div>
        </section>

        {/* Tips & Info Column */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Conversion Tips</h2>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm transition-colors duration-300 text-sm">
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                OCR Fallback
              </h4>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                If your PDF is scanned or made of images, our backend automatically runs EasyOCR to read the text.
              </p>
            </div>
            
            <hr className="border-slate-100 dark:border-slate-800" />

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Kokoro TTS
              </h4>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Audio is synthesized using Kokoro-82M, providing human-like inflection, rhythm, and clear pronunciation.
              </p>
            </div>

            <hr className="border-slate-100 dark:border-slate-800" />

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Offline Listening
              </h4>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                All generated audiobooks are saved as highly compressed MP3s, making downloads fast and playback offline-friendly.
              </p>
            </div>
          </div>
        </section>

      </div>

      {/* Recent Books Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Recent Conversions</h2>
          <span className="text-sm font-medium text-slate-400">Showing last 6 uploads</span>
        </div>
        
        {audiobooks.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-500">
            No audiobooks in your library yet. Upload a PDF to start listening!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {audiobooks.slice(0, 6).map((book) => {
              const isCompleted = book.status === 'completed';
              const isFailed = book.status === 'failed';
              
              return (
                <div 
                  key={book.id} 
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border
                        ${isCompleted 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30' 
                          : isFailed
                          ? 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/30'
                          : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30 animate-pulse'
                        }
                      `}>
                        {book.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-semibold text-base line-clamp-1 text-slate-800 dark:text-slate-100" title={book.title}>
                        {book.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        Created {formatJoinedDate(book.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    {/* Progress indicator */}
                    {!isCompleted && !isFailed ? (
                      <div className="flex-1 pr-4">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                          <span className="capitalize">
                            {book.status.includes('(') 
                              ? book.status.replace('processing (', 'Processing ').replace(')', '')
                              : 'Converting...'
                            }
                          </span>
                          <span>{book.progress_percent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${book.progress_percent}%` }}></div>
                        </div>
                      </div>
                    ) : isCompleted ? (
                      <>
                        <button 
                          onClick={() => router.push(`/audiobook/${book.id}`)}
                          className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors group"
                        >
                          <span>Listen now</span>
                          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                        </button>
                        
                        <button 
                          onClick={() => router.push(`/audiobook/${book.id}`)}
                          className="w-8 h-8 rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 flex items-center justify-center transition-colors"
                        >
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </button>
                      </>
                    ) : (
                      <p className="text-xs text-rose-500">Failed to process. Please retry.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
