import os
import torch
import torchaudio
import librosa
import numpy as np
import tempfile
import logging
from typing import Optional, Dict, Any

from fastapi import FastAPI, File, UploadFile, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Sema-ASR API",
    description="API for Swahili Speech-to-Text using Wav2Vec2",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model-related variables
asr_processor = None
asr_model = None
asr_device = None

# Audio configuration
SAMPLE_RATE = 16000
MAX_INPUT_LENGTH = 30  # Maximum audio length in seconds

class ASRError(Exception):
    """Custom exception for ASR-related errors"""
    pass

def load_model(model_name: str = "RareElf/swahili-wav2vec2-asr") -> None:
    """Load the Wav2Vec2 ASR model and processor.
    
    Args:
        model_name: Name or path of the pretrained model
        
    Raises:
        ASRError: If there's an error loading the model
    """
    global asr_processor, asr_model, asr_device
    
    try:
        logger.info(f"Loading ASR model: {model_name}")
        
        # Set device
        asr_device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {asr_device}")
        
        # Load processor and model
        logger.info("Loading processor...")
        asr_processor = Wav2Vec2Processor.from_pretrained(model_name)
        
        logger.info("Loading model...")
        asr_model = Wav2Vec2ForCTC.from_pretrained(model_name).to(asr_device)
        
        # Set model to evaluation mode
        asr_model.eval()
        
        logger.info(f"Model loaded successfully on {asr_device}")
        
    except Exception as e:
        error_msg = f"Failed to load ASR model: {str(e)}"
        logger.error(error_msg)
        raise ASRError(error_msg) from e

# Load model on startup
load_model()

def preprocess_audio(audio_path: str) -> torch.Tensor:
    """Load and preprocess audio file.
    
    Args:
        audio_path: Path to the audio file
        
    Returns:
        torch.Tensor: Preprocessed audio waveform
        
    Raises:
        ASRError: If there's an error loading or processing the audio
    """
    try:
        # Load audio with librosa (handles various formats)
        waveform, sample_rate = librosa.load(
            audio_path,
            sr=SAMPLE_RATE,
            mono=True,
            duration=MAX_INPUT_LENGTH
        )
        
        # Convert to PyTorch tensor
        waveform = torch.FloatTensor(waveform).unsqueeze(0)  # Add batch dimension
        
        return waveform
        
    except Exception as e:
        error_msg = f"Error processing audio: {str(e)}"
        logger.error(error_msg)
        raise ASRError(error_msg) from e

def transcribe(audio_path: str) -> str:
    """Transcribe audio file to text.
    
    Args:
        audio_path: Path to the audio file
        
    Returns:
        str: Transcribed text
        
    Raises:
        ASRError: If there's an error during transcription
    """
    global asr_processor, asr_model, asr_device
    
    if asr_processor is None or asr_model is None:
        raise ASRError("ASR model not loaded")
    
    try:
        # Preprocess audio
        waveform = preprocess_audio(audio_path)
        
        # Process with model
        inputs = asr_processor(
            waveform.squeeze().numpy(),
            sampling_rate=SAMPLE_RATE,
            return_tensors="pt",
            padding=True
        )
        
        # Move inputs to the same device as model
        inputs = {k: v.to(asr_device) for k, v in inputs.items()}
        
        # Get model predictions
        with torch.no_grad():
            logits = asr_model(**inputs).logits
            
        # Decode predictions
        predicted_ids = torch.argmax(logits, dim=-1)
        transcription = asr_processor.batch_decode(predicted_ids)[0]
        
        logger.debug(f"Raw transcription: {transcription}")
        return transcription.strip()
        
    except Exception as e:
        error_msg = f"Transcription failed: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise ASRError(error_msg) from e

@app.post("/transcribe/", response_model=Dict[str, Any])
async def transcribe_audio(
    file: UploadFile = File(..., description="Audio file to transcribe (WAV, MP3, etc.)"),
    language: Optional[str] = "sw"
) -> Dict[str, Any]:
    """Transcribe an audio file to text using the Swahili ASR model.
    
    Args:
        file: Audio file to transcribe
        language: Language code (default: "sw" for Swahili)
        
    Returns:
        Dict containing the transcription and metadata
    """
    # Validate file type
    audio_extensions = {'.wav', '.mp3', '.ogg', '.flac', '.aac', '.m4a', '.wma'}
    file_extension = os.path.splitext(file.filename or '')[1].lower()
    
    # Check content type if available, otherwise check file extension
    if file.content_type is not None and not file.content_type.startswith('audio/'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Expected audio file, got {file.content_type}"
        )
    elif file_extension not in audio_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported audio format. Supported formats: {', '.join(audio_extensions)}"
        )
    
    # Create a temporary file to store the uploaded audio
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            contents = await file.read()
            temp_file.write(contents)
            temp_file_path = temp_file.name
            
    except Exception as e:
        error_msg = f"Failed to save uploaded file: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_msg
        )
    
    # Process the audio file
    try:
        logger.info(f"Processing audio file: {file.filename}")
        
        # Transcribe the audio
        transcription = transcribe(temp_file_path)
        
        # Prepare response
        response = {
            "status": "success",
            "transcription": transcription,
            "language": language,
            "model": "RareElf/swahili-wav2vec2-asr",
            "model_version": "1.0.0",
            "duration_seconds": None  # Could be added if needed
        }
        
        return response
        
    except ASRError as e:
        error_msg = f"ASR processing error: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_msg
        )
        
    except Exception as e:
        error_msg = f"Unexpected error during transcription: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during transcription"
        )
        
    finally:
        # Clean up temporary file
        try:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
        except Exception as e:
            logger.warning(f"Failed to delete temporary file: {str(e)}")

@app.get("/health", response_model=Dict[str, Any])
async def health_check() -> Dict[str, Any]:
    """Health check endpoint.
    
    Returns:
        Dict containing health status and system information
    """
    try:
        # Basic health check
        model_status = "loaded" if asr_model is not None else "not loaded"
        device = str(asr_device) if asr_device else "unknown"
        
        return {
            "status": "healthy",
            "model_loaded": asr_model is not None,
            "model_status": model_status,
            "device": device,
            "max_audio_length_seconds": MAX_INPUT_LENGTH,
            "sample_rate": SAMPLE_RATE
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }

@app.get("/")
async def root():
    return "Welcome to Sema-ASR API!"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
