import os
import glob
import subprocess
import time
import numpy as np
from fastapi import FastAPI, BackgroundTasks
from supabase import create_client, Client
from pypdf import PdfReader
from kokoro import KPipeline
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow Next.js to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Load Local .env if present ---
if os.path.exists(".env"):
    with open(".env") as f:
        for line in f:
            if line.strip() and not line.startswith("#"):
                parts = line.strip().split("=", 1)
                if len(parts) == 2:
                    os.environ[parts[0].strip()] = parts[1].strip()

# --- Configurations ---
SUPABASE_URL = os.environ.get("SUPABASE_URL") or "https://vfuabdwgqjqnsllyxufz.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not SUPABASE_KEY:
    raise ValueError("SUPABASE_KEY environment variable is missing!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Pipeline Cache for Multi-language Support
pipelines = {}

print("Preloading default English Kokoro model on main thread...")
pipelines['a'] = KPipeline(lang_code='a')

def get_pipeline(lang: str) -> KPipeline:
    if lang not in pipelines:
        print(f"Loading Kokoro Model for language '{lang}' (first time)...")
        pipelines[lang] = KPipeline(lang_code=lang)
    return pipelines[lang]

# Time Formatting Helper
def format_time_left(seconds: float) -> str:
    if seconds < 60:
        return f"{int(seconds)}s left"
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    if minutes < 60:
        return f"{minutes}m {secs}s left"
    hours = int(minutes // 60)
    mins = int(minutes % 60)
    return f"{hours}h {mins}m left"

def process_audiobook(file_path: str, user_id: str, audiobook_id: str, voice: str = "af_heart", lang: str = "a"):
    local_pdf_path = f"temp_{audiobook_id}.pdf"
    local_mp3_path = f"temp_{audiobook_id}.mp3"
    
    try:
        print(f"Starting job for audiobook {audiobook_id} with voice={voice}, lang={lang}")
        
        # 1. Download PDF from Supabase
        print("Downloading PDF...")
        pdf_bytes = supabase.storage.from_("media").download(file_path)
        
        with open(local_pdf_path, "wb") as f:
            f.write(pdf_bytes)
            
        # 2. Extract Text
        print("Extracting text from PDF...")
        reader = PdfReader(local_pdf_path)
        full_text = ""
        for page in reader.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"
                
        # --- AUTOMATIC OCR FALLBACK ---
        ocr_performed = False
        if len(full_text.strip()) < 50:
            print("No selectable text detected! Initializing OCR engine...")
            ocr_performed = True
            supabase.table("audiobooks").update({"status": "processing (OCR)", "progress_percent": 0}).eq("id", audiobook_id).execute()
            
            import easyocr
            import pymupdf
            
            ocr_reader = easyocr.Reader(['en'])
            doc = pymupdf.open(local_pdf_path)
            total_pages = len(doc)
            
            full_text = ""
            ocr_start_time = time.time()
            for i, page in enumerate(doc):
                print(f"Running OCR on page {i+1} of {total_pages}...")
                
                # Render to memory bytes instead of saving file to disk
                pix = page.get_pixmap(dpi=150)
                img_bytes = pix.tobytes("png")
                
                text_list = ocr_reader.readtext(img_bytes, detail=0)
                full_text += " ".join(text_list) + "\n\n"
                
                # Check if job was deleted/cancelled by the user
                if (i + 1) % 2 == 0:
                    check_res = supabase.table("audiobooks").select("id").eq("id", audiobook_id).execute()
                    if not check_res.data:
                        print(f"Job {audiobook_id} was deleted/cancelled by user. Aborting OCR...")
                        raise InterruptedError("Cancelled by user")
                
                # Calculate remaining time for OCR
                elapsed = time.time() - ocr_start_time
                avg_time_per_page = elapsed / (i + 1)
                remaining_pages = total_pages - (i + 1)
                est_seconds_left = avg_time_per_page * remaining_pages
                time_str = format_time_left(est_seconds_left)
                
                # Scale OCR progress from 0% to 40% of the total progress
                ocr_progress = int(((i + 1) / total_pages) * 40)
                supabase.table("audiobooks").update({
                    "progress_percent": ocr_progress,
                    "status": f"processing (OCR) • {time_str}"
                }).eq("id", audiobook_id).execute()
                
            print(f"DEBUG: OCR successfully extracted {len(full_text)} characters.")
            
            if not full_text.strip():
                 raise ValueError("Even OCR could not find text. The images might be completely blank.")
                 
            # Release the PDF file lock and clean VRAM
            doc.close()
            import gc
            import torch
            del ocr_reader
            gc.collect()
            torch.cuda.empty_cache()
        # --------------------------------
        
        # 3. Generate Audio with Kokoro
        print("Generating audio arrays...")
        # Instantly update status to audio phase
        supabase.table("audiobooks").update({
            "status": "processing (Audio)",
            "progress_percent": 0
        }).eq("id", audiobook_id).execute()
        
        pipeline = get_pipeline(lang)
        
        # Estimate total sentences/chunks for progress calculations
        total_sentences = max(5, full_text.count('.') + full_text.count('?') + full_text.count('!'))
        
        all_audio = []
        generator = pipeline(full_text, voice=voice, speed=1.0)
        
        audio_start_time = time.time()
        for i, (gs, ps, audio) in enumerate(generator):
            all_audio.append(audio)
            
            # Check if job was deleted/cancelled by the user (every 10 sentences)
            if i % 10 == 0:
                check_res = supabase.table("audiobooks").select("id").eq("id", audiobook_id).execute()
                if not check_res.data:
                    print(f"Job {audiobook_id} was deleted/cancelled by user. Aborting Audio Gen...")
                    raise InterruptedError("Cancelled by user")
            
            # Calculate remaining time for Audio Generation
            elapsed = time.time() - audio_start_time
            avg_time_per_sentence = elapsed / (i + 1)
            remaining_sentences = max(0, total_sentences - (i + 1))
            est_seconds_left = avg_time_per_sentence * remaining_sentences
            time_str = format_time_left(est_seconds_left)
            
            # Map progress:
            # - If OCR ran, Audio goes from 40% to 95%.
            # - If OCR was skipped, Audio goes from 0% to 95%.
            start_percent = 40 if ocr_performed else 0
            remaining_percent = 95 - start_percent
            audio_progress = start_percent + int(((i + 1) / total_sentences) * remaining_percent)
            current_prog = min(95, audio_progress)
            
            supabase.table("audiobooks").update({
                "progress_percent": current_prog,
                "status": f"processing (Audio) • {time_str}"
            }).eq("id", audiobook_id).execute()
            
        if not all_audio:
            raise ValueError("No audio arrays were generated.")
            
        # 4. Merge Audio & Compress with FFmpeg (In-Memory Pipe)
        print("Merging and converting to MP3...")
        supabase.table("audiobooks").update({
            "progress_percent": 96,
            "status": "processing (Compressing)"
        }).eq("id", audiobook_id).execute()
        
        final_audio = np.concatenate(all_audio)
        
        # Stream raw float32 audio bytes directly into FFmpeg's standard input
        # This completely bypasses writing a temporary WAV file to disk!
        ffmpeg_process = subprocess.Popen([
            'ffmpeg', '-y', '-f', 'f32le', '-ar', '24000', '-ac', '1',
            '-i', 'pipe:0', '-b:a', '64k', local_mp3_path
        ], stdin=subprocess.PIPE)
        ffmpeg_process.communicate(input=final_audio.tobytes())
        
        # 5. Upload MP3 back to Supabase
        print("Uploading finished MP3 to database...")
        supabase.table("audiobooks").update({
            "progress_percent": 98,
            "status": "processing (Uploading)"
        }).eq("id", audiobook_id).execute()
        
        mp3_storage_path = f"{user_id}/{audiobook_id}.mp3"
        with open(local_mp3_path, "rb") as f:
            supabase.storage.from_("media").upload(
                file=f, 
                path=mp3_storage_path, 
                file_options={"content-type": "audio/mpeg"}
            )
            
        # 6. Finalize Database Status
        public_url = supabase.storage.from_("media").get_public_url(mp3_storage_path)
        supabase.table("audiobooks").update({
            "status": "completed",
            "progress_percent": 100,
            "audio_url": public_url
        }).eq("id", audiobook_id).execute()
        
        print("Job finished successfully!")
        
    except Exception as e:
        print(f"Error processing audiobook: {e}")
        supabase.table("audiobooks").update({"status": "failed"}).eq("id", audiobook_id).execute()
        
    finally:
        print("Cleaning up temporary files...")
        for f in [local_pdf_path, local_mp3_path]:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception as e:
                    print(f"Could not remove {f}: {e}")
            
# The endpoint the frontend pings
@app.post("/generate")
async def generate_audiobook(
    file_path: str, 
    user_id: str, 
    audiobook_id: str, 
    background_tasks: BackgroundTasks,
    voice: str = "af_heart",
    lang: str = "a"
):
    background_tasks.add_task(process_audiobook, file_path, user_id, audiobook_id, voice, lang)
    return {"message": "Audiobook processing started"}