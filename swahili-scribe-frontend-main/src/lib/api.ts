// Maximum file size: 25MB (adjust as needed)
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const API_TIMEOUT = 30000; // 30 seconds

// Supported audio MIME types
export const SUPPORTED_AUDIO_TYPES = [
  'audio/wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
  'audio/ogg; codecs=opus',
];

export type HealthResponse = Record<string, unknown> | { status: string } | null;

export interface TranscribeResponse {
  transcription?: string;
  text?: string;
  language?: string;
  duration?: number;
  [key: string]: any;
}

export class APIError extends Error {
  status?: number;
  code?: string;
  
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
  }
}

// Helper function to validate file
const validateFile = (file: File): void => {
  if (!SUPPORTED_AUDIO_TYPES.includes(file.type)) {
    throw new APIError(
      'Unsupported file type. Please upload a WAV, MP3, or OGG file.',
      400,
      'UNSUPPORTED_FILE_TYPE'
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new APIError(
      `File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      400,
      'FILE_TOO_LARGE'
    );
  }
};

// Get the base URL from localStorage
const getStoredBaseUrl = (): string => {
  return localStorage.getItem("semaApiBaseUrl") || 
    (process.env.NODE_ENV === 'development' ? 'http://localhost:8001' : '/api');
};

export const setBaseUrl = (url: string): void => {
  localStorage.setItem("semaApiBaseUrl", url);
};

export const getBaseUrl = (): string => getStoredBaseUrl();

// Generic fetch with timeout
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = API_TIMEOUT): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new APIError('Request timed out. Please try again.', 408, 'REQUEST_TIMEOUT');
    }
    throw error;
  }
};

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const base = getBaseUrl();
  if (!base) {
    throw new APIError('API base URL is not configured', 400, 'MISSING_BASE_URL');
  }

  try {
    const res = await fetchWithTimeout(`${base}/health`, { signal });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new APIError(
        errorData.detail || `Health check failed: ${res.statusText}`,
        res.status,
        errorData.code
      );
    }
    
    return res.json();
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new APIError(
      error instanceof Error ? error.message : 'Failed to check API health',
      0,
      'NETWORK_ERROR'
    );
  }
}

export async function postTranscribe(
  file: File,
  language = "sw",
  signal?: AbortSignal,
  onProgress?: (progress: number) => void
): Promise<TranscribeResponse> {
  validateFile(file);
  
  const base = getBaseUrl();
  if (!base) {
    throw new APIError('API base URL is not configured', 400, 'MISSING_BASE_URL');
  }

  const form = new FormData();
  form.append("file", file);
  
  const url = `${base}/transcribe/?language=${encodeURIComponent(language)}`;
  
  try {
    const xhr = new XMLHttpRequest();
    
    // Set up progress tracking
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      };
    }
    
    const response = await new Promise<{status: number, data: any}>((resolve, reject) => {
      xhr.open('POST', url, true);
      
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({
            status: xhr.status,
            data
          });
        } catch (error) {
          reject(new APIError('Failed to parse response', 500, 'PARSE_ERROR'));
        }
      };
      
      xhr.onerror = () => {
        reject(new APIError('Network error', 0, 'NETWORK_ERROR'));
      };
      
      xhr.ontimeout = () => {
        reject(new APIError('Request timed out', 408, 'REQUEST_TIMEOUT'));
      };
      
      if (signal) {
        signal.onabort = () => {
          xhr.abort();
          reject(new APIError('Request was aborted', 0, 'ABORTED'));
        };
      }
      
      xhr.timeout = API_TIMEOUT;
      xhr.send(form);
    });
    
    if (response.status >= 400) {
      throw new APIError(
        response.data?.detail || `Request failed with status ${response.status}`,
        response.status,
        response.data?.code
      );
    }
    
    return response.data;
  } catch (error) {
    if (error instanceof APIError) throw error;
    throw new APIError(
      error instanceof Error ? error.message : 'Failed to transcribe audio',
      0,
      'UNKNOWN_ERROR'
    );
  }
}
