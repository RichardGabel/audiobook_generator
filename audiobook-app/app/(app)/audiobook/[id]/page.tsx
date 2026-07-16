'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  ArrowLeft,
  Loader2,
  Music,
  Gauge,
  BookOpen,
  Download,
  Moon,
  Clock,
  Keyboard
} from 'lucide-react';

export default function AudiobookPlayer() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [audiobook, setAudiobook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Custom Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  
  // PDF Reader State
  const [showReader, setShowReader] = useState(false);
  const [pdfPublicUrl, setPdfPublicUrl] = useState('');

  // Sleep Timer State
  const [sleepTimer, setSleepTimer] = useState<number | null>(null); // remaining seconds
  const [sleepTimerOption, setSleepTimerOption] = useState<string>('off');
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  
  // LocalStorage throttle saving
  const lastSavedTime = useRef(0);

  // Stop previous audio and load audiobook data when ID changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    }
    
    const fetchAudiobook = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/');

      const { data, error } = await supabase
        .from('audiobooks')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error || !data) {
        alert("Audiobook not found.");
        router.push('/dashboard');
      } else {
        setAudiobook(data);
        setEditTitle(data.title);
        
        // Fetch public URL for PDF reader
        const { data: pdfData } = supabase.storage.from('media').getPublicUrl(data.pdf_url);
        if (pdfData?.publicUrl) {
          setPdfPublicUrl(pdfData.publicUrl);
        }
      }
      setLoading(false);
    };

    if (params.id) {
      fetchAudiobook();
    }
  }, [params.id, router, supabase]);

  // CRITICAL BUG FIX: Ensure the audio element is paused and source is reset when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
      }
    };
  }, []);

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingTitle) return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skipForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skipBackward();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(prev => Math.min(1, prev + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(prev => Math.max(0, prev - 0.05));
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, duration, volume, isEditingTitle, playbackRate]);

  // Sleep Timer Counter
  useEffect(() => {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }

    if (sleepTimer !== null && sleepTimer > 0 && isPlaying) {
      sleepTimerRef.current = setInterval(() => {
        setSleepTimer(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            // Timer finished, trigger fade out and pause
            triggerSleepTimerPause();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
      }
    };
  }, [sleepTimer, isPlaying]);

  // Sync playback rate when changed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Sync volume & muted state when changed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Audio Control Functions
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => {
          if (audioRef.current) audioRef.current.playbackRate = playbackRate;
          setIsPlaying(true);
        })
        .catch(err => console.error("Playback error:", err));
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const total = audioRef.current.duration || 0;
    setCurrentTime(current);
    if (total > 0) {
      setProgress((current / total) * 100);
    }

    // Save playback position to localStorage every 2 seconds
    if (Math.abs(current - lastSavedTime.current) > 2) {
      localStorage.setItem(`audiobook_position_${params.id}`, current.toString());
      lastSavedTime.current = current;
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
      audioRef.current.playbackRate = playbackRate;
      
      // Restore saved playback position from localStorage
      const savedTimeStr = localStorage.getItem(`audiobook_position_${params.id}`);
      if (savedTimeStr) {
        const savedTime = parseFloat(savedTimeStr);
        if (savedTime > 0 && savedTime < audioRef.current.duration - 5) {
          audioRef.current.currentTime = savedTime;
          setCurrentTime(savedTime);
          setProgress((savedTime / audioRef.current.duration) * 100);
        }
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    // Clear playback position on completion
    localStorage.removeItem(`audiobook_position_${params.id}`);
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || duration === 0) return;
    const newTime = (Number(e.target.value) / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(Number(e.target.value));
  };

  const skipForward = () => {
    if (!audioRef.current) return;
    const newTime = Math.min(duration, audioRef.current.currentTime + 15);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skipBackward = () => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, audioRef.current.currentTime - 15);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (val > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
  };

  const handleSleepTimerSelect = (option: string) => {
    setSleepTimerOption(option);
    if (option === 'off') {
      setSleepTimer(null);
    } else {
      const minutes = parseInt(option, 10);
      setSleepTimer(minutes * 60);
    }
  };

  // Fade out volume and pause player when sleep timer completes
  const triggerSleepTimerPause = () => {
    if (!audioRef.current) return;
    
    let currentVol = volume;
    const fadeInterval = setInterval(() => {
      if (audioRef.current) {
        if (currentVol > 0.05) {
          currentVol -= 0.05;
          audioRef.current.volume = Math.max(0, currentVol);
        } else {
          audioRef.current.pause();
          setIsPlaying(false);
          // Restore original volume properties
          audioRef.current.volume = volume;
          setIsMuted(isMuted);
          clearInterval(fadeInterval);
          setSleepTimerOption('off');
          setSleepTimer(null);
        }
      } else {
        clearInterval(fadeInterval);
      }
    }, 150);
  };

  const handleDownload = () => {
    if (!audiobook?.audio_url) return;
    // Open the download link in a new tab
    const anchor = document.createElement('a');
    anchor.href = audiobook.audio_url;
    anchor.download = `${audiobook.title}.mp3`;
    anchor.target = '_blank';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time === Infinity) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const formatTimerClock = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleRenameTitle = async () => {
    if (!editTitle.trim()) return cancelRename();
    setIsSavingTitle(true);
    try {
      const { error } = await supabase
        .from('audiobooks')
        .update({ title: editTitle.trim() })
        .eq('id', params.id);

      if (error) throw error;
      setAudiobook((prev: any) => ({ ...prev, title: editTitle.trim() }));
      setIsEditingTitle(false);
    } catch (err: any) {
      alert("Failed to update name: " + err.message);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const cancelRename = () => {
    setIsEditingTitle(false);
    setEditTitle(audiobook?.title || '');
  };

  const handleDelete = async () => {
    if (!audiobook) return;
    const isConfirmed = window.confirm("Are you sure you want to delete this audiobook? This will permanently delete the audio file and its record.");
    if (!isConfirmed) return;

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }

      // Delete files from Supabase Storage
      const mp3Path = `${audiobook.user_id}/${audiobook.id}.mp3`;
      const pdfPath = audiobook.pdf_url;
      await supabase.storage.from('media').remove([pdfPath, mp3Path]);

      // Delete database row
      const { error } = await supabase
        .from('audiobooks')
        .delete()
        .eq('id', audiobook.id);

      if (error) throw error;

      router.push('/dashboard');
    } catch (err: any) {
      alert("Error deleting audiobook: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-slate-505 font-medium">Loading player...</p>
      </div>
    );
  }

  if (!audiobook) return null;

  return (
    <div className={`p-4 md:p-6 mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500 max-w-7xl`}>
      
      {/* Top Header Options */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button 
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Library</span>
        </button>

        {/* Read along Toggle & Download */}
        <div className="flex items-center gap-2.5 self-end">
          <button
            onClick={() => setShowReader(!showReader)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all shadow-sm
              ${showReader 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-900/60 dark:text-indigo-400' 
                : 'bg-white border-slate-250 dark:bg-slate-900 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }
            `}
            title="Read along PDF side-by-side"
          >
            <BookOpen className="w-4 h-4" />
            <span>{showReader ? 'Hide PDF' : 'Read PDF'}</span>
          </button>
          
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-white border border-slate-250 dark:bg-slate-900 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors shadow-sm"
            title="Download MP3"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Grid Layout for Split Screen */}
      <div className={`grid grid-cols-1 gap-6 transition-all duration-550 ease-in-out
        ${showReader ? 'lg:grid-cols-12' : 'max-w-3xl mx-auto'}
      `}>
        
        {/* Left Side: Audio Player Panel */}
        <div className={`${showReader ? 'lg:col-span-5' : 'w-full'}`}>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-md relative overflow-hidden transition-colors duration-300">
            
            {/* Background glows */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-600/5 dark:bg-violet-600/10 rounded-full blur-3xl -z-10"></div>

            <div className="flex flex-col items-center">
              
              {/* Cover Art Box */}
              <div className="relative w-44 h-44 md:w-48 md:h-48 rounded-2xl bg-gradient-to-tr from-slate-100 to-indigo-100 dark:from-slate-800 dark:to-slate-950 flex items-center justify-center shadow-inner border border-slate-200/50 dark:border-slate-800/80 mb-6 select-none group">
                <Music className="w-16 h-16 text-indigo-400 dark:text-indigo-600 animate-pulse" />
                
                {/* Visualizer Overlay */}
                {isPlaying && (
                  <div className="absolute inset-x-0 bottom-4 flex items-end justify-center gap-1 px-4 h-8 overflow-hidden">
                    <span className="w-1 bg-indigo-500 rounded-full animate-bar-1" style={{ height: '70%' }}></span>
                    <span className="w-1 bg-indigo-500 rounded-full animate-bar-2" style={{ height: '35%' }}></span>
                    <span className="w-1 bg-indigo-500 rounded-full animate-bar-3" style={{ height: '90%' }}></span>
                    <span className="w-1 bg-indigo-500 rounded-full animate-bar-4" style={{ height: '50%' }}></span>
                    <span className="w-1 bg-indigo-500 rounded-full animate-bar-5" style={{ height: '80%' }}></span>
                  </div>
                )}
              </div>

              {/* Audiobook Info */}
              <div className="w-full text-center mb-6 relative px-4">
                {isEditingTitle ? (
                  <div className="flex items-center justify-center gap-1.5 max-w-sm mx-auto">
                    <input 
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameTitle();
                        if (e.key === 'Escape') cancelRename();
                      }}
                      autoFocus
                      className="w-full text-lg md:text-xl font-bold text-center bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-850 dark:text-slate-100"
                      disabled={isSavingTitle}
                    />
                    <button 
                      onClick={handleRenameTitle}
                      disabled={isSavingTitle}
                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors"
                    >
                      {isSavingTitle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={cancelRename}
                      disabled={isSavingTitle}
                      className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-650 dark:text-slate-300 hover:bg-slate-350 dark:hover:bg-slate-750 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="group inline-flex items-center justify-center gap-2 max-w-full">
                    <h1 
                      className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-slate-100 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      onDoubleClick={() => setIsEditingTitle(true)}
                      title="Double click to rename"
                    >
                      {audiobook.title}
                    </h1>
                    <button 
                      onClick={() => setIsEditingTitle(true)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Rename Audiobook"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <p className="text-xs font-semibold text-slate-400 mt-1">
                  Kokoro TTS • American Accent
                </p>
              </div>

              {/* HTML5 Audio element */}
              {audiobook.audio_url && (
                <audio 
                  ref={audioRef}
                  src={audiobook.audio_url}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={handleEnded}
                />
              )}

              {/* Custom Player Controls */}
              <div className="w-full space-y-5">
                
                {/* Timeline Slider */}
                <div className="space-y-1.5">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={progress || 0} 
                    onChange={handleScrub}
                    disabled={duration === 0}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500 focus:outline-none transition-colors"
                  />
                  
                  <div className="flex justify-between text-xs font-bold text-slate-400 select-none">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Main controls row */}
                <div className="flex flex-col gap-4 select-none">
                  
                  {/* Speed, Sleep timer, Shortcuts Indicators */}
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3 text-xs font-semibold text-slate-550 dark:text-slate-400">
                    
                    {/* Playback speed selector */}
                    <div className="flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-slate-400" />
                      <select 
                        value={playbackRate}
                        onChange={(e) => handleSpeedChange(Number(e.target.value))}
                        className="bg-transparent text-slate-700 dark:text-slate-350 focus:outline-none cursor-pointer border-0 font-semibold p-0 pr-1 text-xs"
                      >
                        <option value="0.5">0.5x</option>
                        <option value="0.8">0.8x</option>
                        <option value="1.0">1.0x</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2.0">2.0x</option>
                      </select>
                    </div>

                    {/* Sleep Timer */}
                    <div className="flex items-center gap-1.5">
                      {sleepTimer !== null ? <Clock className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> : <Moon className="w-3.5 h-3.5 text-slate-400" />}
                      <select
                        value={sleepTimerOption}
                        onChange={(e) => handleSleepTimerSelect(e.target.value)}
                        className={`bg-transparent focus:outline-none cursor-pointer border-0 font-semibold p-0 pr-1 text-xs
                          ${sleepTimer !== null ? 'text-indigo-500' : 'text-slate-700 dark:text-slate-350'}
                        `}
                      >
                        <option value="off">Timer Off</option>
                        <option value="5">5 Min</option>
                        <option value="15">15 Min</option>
                        <option value="30">30 Min</option>
                        <option value="45">45 Min</option>
                        <option value="60">60 Min</option>
                      </select>
                      {sleepTimer !== null && (
                        <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400 font-bold ml-0.5">
                          {formatTimerClock(sleepTimer)}
                        </span>
                      )}
                    </div>

                    {/* Keyboard Shortcuts tooltip */}
                    <div className="flex items-center gap-1 text-slate-400" title="Shortcuts: Space (Play/Pause), Left/Right (Skip), Up/Down (Volume)">
                      <Keyboard className="w-3.5 h-3.5" />
                      <span>Shortcuts</span>
                    </div>

                  </div>

                  {/* Play Buttons Row */}
                  <div className="flex items-center justify-between gap-4 pt-1">
                    
                    {/* Volume Controls */}
                    <div className="flex items-center gap-1.5 w-[85px] sm:w-[110px]">
                      <button 
                        onClick={toggleMute}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 transition-colors"
                        title={isMuted ? "Unmute" : "Mute"}
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-4 h-4 text-rose-500" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                      <input 
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-12 sm:w-16 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-650 focus:outline-none"
                      />
                    </div>

                    {/* Play/Pause controls */}
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={skipBackward}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 transition-colors"
                        title="Skip back 15s"
                      >
                        <RotateCcw className="w-5 h-5" />
                      </button>

                      <button 
                        onClick={togglePlay}
                        className="w-12 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-md shadow-indigo-600/10 transition-transform active:scale-95 duration-100"
                        title={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        )}
                      </button>

                      <button 
                        onClick={skipForward}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 transition-colors"
                        title="Skip forward 15s"
                      >
                        <RotateCw className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Placeholder space to balance flexbox */}
                    <div className="w-[85px] sm:w-[110px] flex justify-end">
                      <button 
                        onClick={handleDelete}
                        className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-450 transition-colors"
                        title="Delete Audiobook"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>
        </div>

        {/* Right Side: PDF Read-Along Viewer (Only shown when showReader is true) */}
        {showReader && (
          <div className="lg:col-span-7 animate-in slide-in-from-right duration-300">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-md flex flex-col h-[520px] lg:h-[600px] overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3 px-2">
                <span className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  <span>PDF Document Viewer</span>
                </span>
                
                <button
                  onClick={() => setShowReader(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Close PDF view"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {pdfPublicUrl ? (
                <iframe 
                  src={`${pdfPublicUrl}#toolbar=0`} 
                  className="w-full flex-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner bg-slate-50 dark:bg-slate-950"
                  title="Audiobook PDF Viewer"
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                  <p className="text-xs">Loading PDF stream...</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Styled animation tags for visualizer */}
      <style jsx global>{`
        @keyframes float-bar-1 {
          0%, 100% { height: 30%; }
          50% { height: 85%; }
        }
        @keyframes float-bar-2 {
          0%, 100% { height: 20%; }
          50% { height: 60%; }
        }
        @keyframes float-bar-3 {
          0%, 100% { height: 40%; }
          50% { height: 95%; }
        }
        @keyframes float-bar-4 {
          0%, 100% { height: 15%; }
          50% { height: 70%; }
        }
        @keyframes float-bar-5 {
          0%, 100% { height: 25%; }
          50% { height: 80%; }
        }
        .animate-bar-1 { animation: float-bar-1 1.2s ease-in-out infinite; }
        .animate-bar-2 { animation: float-bar-2 0.8s ease-in-out infinite; }
        .animate-bar-3 { animation: float-bar-3 1.5s ease-in-out infinite; }
        .animate-bar-4 { animation: float-bar-4 1.0s ease-in-out infinite; }
        .animate-bar-5 { animation: float-bar-5 1.3s ease-in-out infinite; }
      `}</style>

    </div>
  );
}
