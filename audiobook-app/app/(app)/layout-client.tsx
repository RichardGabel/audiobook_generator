'use client';

import { useState, useEffect, createContext, useContext, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { 
  Menu, 
  X, 
  Upload, 
  Search, 
  Headphones, 
  BookOpen, 
  FileText, 
  Check, 
  Edit3, 
  LogOut, 
  Loader2, 
  FileWarning, 
  ChevronLeft,
  Settings
} from 'lucide-react';

const LANGUAGE_VOICES: Record<string, { name: string; voices: { id: string; label: string }[] }> = {
  a: {
    name: 'English (US)',
    voices: [
      { id: 'af_heart', label: 'Female - Heart (Classic)' },
      { id: 'af_bella', label: 'Female - Bella' },
      { id: 'af_sarah', label: 'Female - Sarah' },
      { id: 'am_adam', label: 'Male - Adam' },
      { id: 'am_fenrir', label: 'Male - Fenrir' },
      { id: 'am_michael', label: 'Male - Michael' },
    ]
  },
  b: {
    name: 'English (UK)',
    voices: [
      { id: 'bf_emma', label: 'Female - Emma' },
      { id: 'bf_isabella', label: 'Female - Isabella' },
      { id: 'bm_george', label: 'Male - George' },
      { id: 'bm_lewis', label: 'Male - Lewis' },
    ]
  },
  e: {
    name: 'Spanish',
    voices: [
      { id: 'ef_dora', label: 'Female - Dora' },
      { id: 'em_alex', label: 'Male - Alex' },
    ]
  },
  f: {
    name: 'French',
    voices: [
      { id: 'ff_sixtine', label: 'Female - Sixtine' },
      { id: 'fm_julius', label: 'Male - Julius' },
    ]
  },
  j: {
    name: 'Japanese',
    voices: [
      { id: 'jf_alpha', label: 'Female - Alpha' },
      { id: 'jm_kudo', label: 'Male - Kudo' },
    ]
  },
  c: {
    name: 'Chinese',
    voices: [
      { id: 'cf_asia', label: 'Female - Asia' },
      { id: 'cm_zake', label: 'Male - Zake' },
    ]
  },
  h: {
    name: 'Hindi',
    voices: [
      { id: 'hf_alpha', label: 'Female - Alpha' },
      { id: 'hm_omega', label: 'Male - Omega' },
    ]
  },
  i: {
    name: 'Italian',
    voices: [
      { id: 'if_sara', label: 'Female - Sara' },
      { id: 'im_nicola', label: 'Male - Nicola' },
    ]
  },
  p: {
    name: 'Portuguese (BR)',
    voices: [
      { id: 'pf_dora', label: 'Female - Dora' },
      { id: 'pm_alex', label: 'Male - Alex' },
    ]
  }
};

interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  audiobooks: any[];
  setAudiobooks: React.Dispatch<React.SetStateAction<any[]>>;
  uploading: boolean;
  uploadFile: (file: File) => Promise<void>;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

export default function AuthenticatedLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [audiobooks, setAudiobooks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Renaming state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Voice & Language selection state
  const [selectedLang, setSelectedLang] = useState('a');
  const [selectedVoice, setSelectedVoice] = useState('af_heart');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  const handleLangChange = (lang: string) => {
    setSelectedLang(lang);
    const firstVoice = LANGUAGE_VOICES[lang]?.voices[0]?.id || '';
    setSelectedVoice(firstVoice);
  };

  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  // Auto-collapse sidebar when on the audiobook player page on smaller screens
  useEffect(() => {
    if (pathname?.startsWith('/audiobook/')) {
      setIsCollapsed(true);
    } else {
      setIsCollapsed(false);
    }
  }, [pathname]);

  // Fetch initial audiobooks & user
  useEffect(() => {
    const initData = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.push('/auth/login');
        return;
      }
      setUser(currentUser);

      const { data } = await supabase
        .from('audiobooks')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
        
      if (data) setAudiobooks(data);
    };

    initData();

    // Listen for INSERT, UPDATE, and DELETE changes on public.audiobooks
    const channel = supabase.channel('realtime-sidebar-audiobooks')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audiobooks' }, (payload) => {
        setAudiobooks((current) => [payload.new, ...current]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'audiobooks' }, (payload) => {
        setAudiobooks((current) =>
          current.map((book) => (book.id === payload.new.id ? payload.new : book))
        );
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'audiobooks' }, (payload) => {
        setAudiobooks((current) => current.filter((book) => book.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const uploadFile = async (file: File) => {
    try {
      setUploading(true);
      if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file.');
        return;
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('You must be logged in.');

      const filePath = `${currentUser.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: audiobook, error: dbError } = await supabase
        .from('audiobooks')
        .insert({
          user_id: currentUser.id,
          title: file.name.replace('.pdf', ''),
          pdf_url: filePath,
          status: 'processing (OCR)',
          progress_percent: 0
        })
        .select()
        .single();

      if (dbError) throw dbError;

      const processorUrl = process.env.NEXT_PUBLIC_PROCESSOR_URL || "http://localhost:8000";
      const targetUrl = `${processorUrl}/generate?file_path=${encodeURIComponent(filePath)}&user_id=${currentUser.id}&audiobook_id=${audiobook.id}&voice=${selectedVoice}&lang=${selectedLang}`;
      fetch(targetUrl, { method: 'POST' }).catch(() => console.error("Backend processor unreachable"));

      router.push('/dashboard');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const startRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const saveRename = async (id: string) => {
    if (!editTitle.trim()) return cancelRename();
    setIsSavingName(true);
    try {
      const { error } = await supabase
        .from('audiobooks')
        .update({ title: editTitle.trim() })
        .eq('id', id);

      if (error) throw error;
      setEditingId(null);
    } catch (err: any) {
      alert("Failed to update name: " + err.message);
    } finally {
      setIsSavingName(false);
    }
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleDeleteSidebar = async (bookId: string, pdfPath: string, userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isConfirmed = window.confirm("Are you sure you want to cancel and delete this audiobook?");
    if (!isConfirmed) return;

    try {
      // 1. Delete files from Supabase Storage
      const mp3Path = `${userId}/${bookId}.mp3`;
      await supabase.storage.from('media').remove([pdfPath, mp3Path]);

      // 2. Delete row from database
      const { error } = await supabase.from('audiobooks').delete().eq('id', bookId);
      if (error) throw error;
    } catch (err: any) {
      alert("Error deleting audiobook: " + err.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  // Filter audiobooks based on search query
  const filteredAudiobooks = audiobooks.filter(book =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SidebarContext.Provider value={{ 
      isCollapsed, 
      setIsCollapsed, 
      audiobooks, 
      setAudiobooks,
      uploading, 
      uploadFile 
    }}>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        
        {/* SIDEBAR PANEL */}
        <aside 
          className={`relative z-20 flex flex-col bg-slate-900 text-slate-200 border-r border-slate-800 transition-all duration-300 ease-in-out select-none
            ${isCollapsed ? 'w-0 -translate-x-full md:w-16 md:translate-x-0' : 'w-80 translate-x-0'}
          `}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800 bg-slate-950/40">
            {!isCollapsed ? (
              <Link href="/dashboard" className="flex items-center gap-2 font-bold text-white text-lg tracking-tight">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-600/35">
                  <Headphones className="w-5 h-5" />
                </div>
                <span>Audiobook Maker</span>
              </Link>
            ) : (
              <div className="flex items-center justify-center w-full">
                <Link href="/dashboard" className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white shadow-md shadow-indigo-600/35">
                  <Headphones className="w-5 h-5" />
                </Link>
              </div>
            )}
            
            {!isCollapsed && (
              <button 
                onClick={() => setIsCollapsed(true)}
                className="hidden md:flex p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Upload Button */}
          <div className={`border-b border-slate-800 bg-slate-950/20 transition-all duration-300 flex justify-center ${isCollapsed ? 'p-3' : 'p-4'}`}>
            <label className={`relative flex items-center justify-center rounded-xl bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/20 hover:bg-indigo-500 cursor-pointer transition-all active:scale-95 duration-200 disabled:opacity-50 disabled:pointer-events-none
              ${isCollapsed ? 'w-10 h-10 p-0' : 'w-full px-4 py-2.5 gap-2'}
            `}>
              <Upload className="w-4 h-4" />
              {!isCollapsed && <span>{uploading ? 'Uploading...' : 'Upload PDF'}</span>}
              <input 
                type="file" 
                accept=".pdf"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    uploadFile(e.target.files[0]);
                  }
                  e.target.value = '';
                }}
                disabled={uploading}
                className="hidden"
              />
              {uploading && (
                <div className={`absolute ${isCollapsed ? 'inset-0 flex items-center justify-center bg-indigo-600/80 rounded-xl' : 'right-3'}`}>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                </div>
              )}
            </label>
          </div>

          {/* Voice/Language Settings collapsible button */}
          {!isCollapsed && (
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/10">
              <button 
                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                className="flex items-center justify-between w-full text-xs font-semibold text-slate-400 hover:text-white transition-colors py-1"
              >
                <span className="flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5" />
                  <span>Voice Settings ({LANGUAGE_VOICES[selectedLang]?.name})</span>
                </span>
                <span>{showVoiceSettings ? '▲' : '▼'}</span>
              </button>
              
              {showVoiceSettings && (
                <div className="mt-2 space-y-2.5 pb-2 animate-in slide-in-from-top-1 duration-200">
                  {/* Language Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-505 font-bold uppercase tracking-wider block">Language</label>
                    <select
                      value={selectedLang}
                      onChange={(e) => handleLangChange(e.target.value)}
                      className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 font-semibold cursor-pointer"
                    >
                      {Object.entries(LANGUAGE_VOICES).map(([code, data]) => (
                        <option key={code} value={code}>{data.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Voice Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-505 font-bold uppercase tracking-wider block">Voice</label>
                    <select
                      value={selectedVoice}
                      onChange={(e) => setSelectedVoice(e.target.value)}
                      className="w-full text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-200 font-semibold cursor-pointer"
                    >
                      {LANGUAGE_VOICES[selectedLang]?.voices.map((v) => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search Box */}
          {!isCollapsed && (
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/10">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input 
                  type="text"
                  placeholder="Search library..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-880 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
          )}

          {/* Scrollable Library */}
          <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
            {!isCollapsed && (
              <p className="px-2 pb-1.5 text-xs font-semibold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>My Library ({filteredAudiobooks.length})</span>
              </p>
            )}

            {filteredAudiobooks.length === 0 ? (
              !isCollapsed && (
                <div className="px-3 py-6 text-center text-sm text-slate-500">
                  No audiobooks found
                </div>
              )
            ) : (
              filteredAudiobooks.map((book) => {
                const isActive = pathname === `/audiobook/${book.id}`;
                const isProcessing = book.status !== 'completed' && book.status !== 'failed';
                const isFailed = book.status === 'failed';
                
                return (
                  <div 
                    key={book.id}
                    onClick={() => {
                      if (editingId !== book.id && book.status === 'completed') {
                        router.push(`/audiobook/${book.id}`);
                      }
                    }}
                    className={`group relative flex flex-col p-2.5 rounded-lg cursor-pointer transition-all duration-200
                      ${isActive 
                        ? 'bg-indigo-600/90 text-white shadow-md shadow-indigo-600/10' 
                        : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                      }
                      ${book.status !== 'completed' && 'opacity-75 cursor-default'}
                    `}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-colors
                        ${isActive ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-white'}
                      `}>
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        ) : isFailed ? (
                          <FileWarning className="w-4 h-4 text-red-400" />
                        ) : (
                          <FileText className="w-4 h-4 text-indigo-400" />
                        )}
                      </div>

                      {!isCollapsed && (
                        <div className="flex-1 min-w-0 pr-6">
                          {editingId === book.id ? (
                            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                              <input 
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveRename(book.id);
                                  if (e.key === 'Escape') cancelRename();
                                }}
                                autoFocus
                                className="w-full px-1.5 py-0.5 text-xs bg-slate-950 border border-slate-700 rounded text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                disabled={isSavingName}
                              />
                              <button 
                                onClick={() => saveRename(book.id)} 
                                disabled={isSavingName}
                                className="p-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                              >
                                {isSavingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button 
                                onClick={cancelRename} 
                                disabled={isSavingName}
                                className="p-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <h4 
                                className="text-sm font-medium truncate"
                                onDoubleClick={(e) => startRename(book.id, book.title, e)}
                              >
                                {book.title}
                              </h4>
                              
                              {isProcessing ? (
                                <div className="mt-1 space-y-1">
                                  <div className="flex justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                    <span>{book.status.replace('processing (', '').replace(')', '')}</span>
                                    <span>{book.progress_percent}%</span>
                                  </div>
                                  <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                                    <div className="bg-indigo-400 h-1 rounded-full transition-all duration-300" style={{ width: `${book.progress_percent}%` }}></div>
                                  </div>
                                </div>
                              ) : (
                                <p className={`text-xs mt-0.5 ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                                  {isFailed ? 'Generation failed' : 'Ready to listen'}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {!isCollapsed && editingId !== book.id && (
                      book.status === 'completed' ? (
                        <button 
                          onClick={(e) => startRename(book.id, book.title, e)}
                          className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-700
                            ${isActive ? 'text-indigo-100 hover:bg-indigo-700' : 'text-slate-400 hover:text-white'}
                          `}
                          title="Rename Audiobook"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => handleDeleteSidebar(book.id, book.pdf_url, book.user_id, e)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-800 text-rose-400 hover:text-rose-350"
                          title="Cancel & Delete"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* User Profile Card */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/40">
            {user && (
              <div className="flex flex-col gap-3">
                {!isCollapsed && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-indigo-400">
                      {user.email?.[0].toUpperCase() || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400 font-medium">Logged in as</p>
                      <p className="text-xs font-semibold text-white truncate" title={user.email}>
                        {user.email}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between gap-2">
                  {!isCollapsed ? (
                    <>
                      <button 
                        onClick={handleLogout}
                        className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs font-semibold flex-1"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign out</span>
                      </button>
                      <ThemeSwitcher />
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 w-full">
                      <button 
                        onClick={handleLogout}
                        className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        title="Sign out"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                      <ThemeSwitcher />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* MAIN PANEL CONTENT */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
          
          <header className="flex items-center justify-between h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-850 shadow-sm z-10 transition-colors duration-300">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                <Menu className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 font-medium">
                <Link href="/dashboard" className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
                  Dashboard
                </Link>
                {pathname?.startsWith('/audiobook/') && (
                  <>
                    <span>/</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[200px]">
                      Audio Player
                    </span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active Session</span>
              </span>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <Suspense fallback={
              <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-slate-550 font-medium">Loading page...</p>
              </div>
            }>
              {children}
            </Suspense>
          </div>
        </main>

      </div>
    </SidebarContext.Provider>
  );
}
