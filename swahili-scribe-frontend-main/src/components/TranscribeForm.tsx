import { useRef, useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { getBaseUrl, postTranscribe, setBaseUrl, SUPPORTED_AUDIO_TYPES, APIError } from "@/lib/api";
import { Upload, Settings2, FileAudio, Mic, Play, Pause, X, Loader2, Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "./ProgressBar";

// Format bytes to human-readable format
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Format seconds to MM:SS
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

interface AudioState {
  file: File | null;
  url: string | null;
  duration: number;
  isPlaying: boolean;
  currentTime: number;
}

export const TranscribeForm = () => {
  const [language, setLanguage] = useState<string>("sw");
  const [audio, setAudio] = useState<AudioState>({
    file: null,
    url: null,
    duration: 0,
    isPlaying: false,
    currentTime: 0,
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<string>("");
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState(false);
  const [fileError, setFileError] = useState<string>('');
  const [baseUrl, setBaseUrlState] = useState(getBaseUrl());
  
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number>();

  // Clean up audio URL on unmount
  useEffect(() => {
    return () => {
      if (audio.url) {
        if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(audio.url);
        }
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audio.url]);

  // Handle audio playback
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    
    if (audio.isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
        toast({
          title: 'Playback error',
          description: 'Could not play the audio file',
          variant: 'destructive',
        });
      });
    }
    setAudio(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, [audio.isPlaying]);

  // Update current time for audio progress
  const updateTime = useCallback(() => {
    if (!audioRef.current) return;
    setAudio(prev => ({
      ...prev,
      currentTime: audioRef.current?.currentTime || 0,
    }));
    animationRef.current = requestAnimationFrame(updateTime);
  }, []);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!SUPPORTED_AUDIO_TYPES.includes(file.type)) {
      setFileError('Unsupported file type');
      toast({
        title: 'Unsupported file type',
        description: 'Please upload a WAV, MP3, or OGG file.',
        variant: 'destructive',
      });
      return;
    }

    // Clear any previous error
    if (fileError) setFileError('');

    // Create object URL for preview
    const url = URL.createObjectURL(file);
    
    // Load audio to get duration
    const audioEl = new Audio(url);
    // Set initial audio state so UI shows player immediately
    setAudio({
      file,
      url,
      duration: 0,
      isPlaying: false,
      currentTime: 0,
    });
    audioEl.onloadedmetadata = () => {
      setAudio({
        file,
        url,
        duration: audioEl.duration,
        isPlaying: false,
        currentTime: 0,
      });
    };
    
    audioEl.onerror = () => {
      toast({
        title: 'Error loading audio',
        description: 'Could not load the selected audio file',
        variant: 'destructive',
      });
    };
    
    // Reset result when new file is selected
    setResult('');
  };

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const anyEvt: any = e as any;
    const dt: any = anyEvt.dataTransfer || anyEvt.nativeEvent?.dataTransfer;
    let file: File | undefined = dt?.files?.[0]
      || (Array.isArray(dt?.files) ? dt.files[0] : undefined)
      || anyEvt.files?.[0]
      || anyEvt.target?.files?.[0];
    // Support array-shaped files in tests and items API
    if (!file && Array.isArray(dt?.files) && dt.files[0]) {
      file = dt.files[0];
    }
    if (!file && dt?.items && dt.items[0] && dt.items[0].kind === 'file') {
      const maybe = dt.items[0].getAsFile?.();
      if (maybe) file = maybe as File;
    }
    if (file) {
      const event = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(event);
    }
  };

  const onPick = () => fileRef.current?.click();

  // Handle form submission
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!audio.file) {
      toast({
        title: 'No audio file selected',
        description: 'Please select an audio file to transcribe.',
        variant: 'destructive',
      });
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;
    
    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      const res = await postTranscribe(
        audio.file,
        language,
        signal,
        (progress) => setUploadProgress(progress)
      );
      
      const text = res.transcription || res.text || '';
      setResult(text);
      
      toast({
        title: 'Transcription complete',
        description: 'Your audio has been transcribed successfully!',
      });
    } catch (error) {
      if (error instanceof APIError && error.code === 'ABORTED') {
        toast({
          title: 'Upload cancelled',
          description: 'The upload was cancelled by the user.',
        });
      } else if (error instanceof APIError) {
        toast({
          title: 'Transcription failed',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        console.error('Transcription error:', error);
        toast({
          title: 'An error occurred',
          description: 'Failed to transcribe the audio. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Handle API settings save
  const onSaveBase = () => {
    try {
      const url = new URL(baseUrl);
      setBaseUrl(url.origin);
      toast({
        title: 'Sema Sasa API settings saved',
        description: 'The API base URL has been updated.',
      });
    } catch (error) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL (e.g., http://localhost:8000)',
        variant: 'destructive',
      });
    }
  };

  // Handle cancel upload
  const cancelUpload = () => {
    setIsUploading(false);
  };

  // Handle clear all
  const clearAll = () => {
    setAudio({
      file: null,
      url: null,
      duration: 0,
      isPlaying: false,
      currentTime: 0,
    });
    setResult('');
    setFileError('');
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  };

  // Handle drag over to support testing environments that attach files during dragOver
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const anyEvt: any = e as any;
    const dt: any = anyEvt.dataTransfer || anyEvt.nativeEvent?.dataTransfer;
    const candidate = dt?.files?.[0]
      || (Array.isArray(dt?.files) ? dt.files[0] : undefined)
      || anyEvt.files?.[0]
      || anyEvt.target?.files?.[0];
    if (candidate) {
      const event = { target: { files: [candidate] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(event);
    }
  };

  // Handle drag enter similarly, some environments attach files here
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const anyEvt: any = e as any;
    const dt: any = anyEvt.dataTransfer || anyEvt.nativeEvent?.dataTransfer;
    const candidate = dt?.files?.[0]
      || (Array.isArray(dt?.files) ? dt.files[0] : undefined)
      || anyEvt.files?.[0]
      || anyEvt.target?.files?.[0];
    if (candidate) {
      const event = { target: { files: [candidate] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(event);
    }
  };

  return (
    <section id="transcribe" className="container py-12">
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>Transcribe Audio</CardTitle>
            <CardDescription>
              Upload or record audio to transcribe it to text
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setIsApiSettingsOpen(!isApiSettingsOpen)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>API Settings</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Audio Upload Area */}
            <div 
              data-testid="drop-zone"
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                'hover:border-primary/50 cursor-pointer',
                audio.file ? 'border-primary/20' : 'border-muted-foreground/25'
              )}
              onDrop={handleDrop}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onClick={() => !audio.file && fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                data-testid="file-input"
                type="file"
                id="audio-upload"
                aria-label="Upload audio file"
                onChange={handleFileChange}
                accept={SUPPORTED_AUDIO_TYPES.join(',')}
                className="hidden"
                disabled={isUploading}
              />
              <label htmlFor="audio-upload" className="sr-only">
                Upload audio file
              </label>
              {fileError && (
                <p className="text-sm text-red-600" role="alert">
                  {fileError}
                </p>
              )}

              {!audio.file ? (
                <div className="space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium">Drag and drop your audio file here, or click to browse</p>
                    <p className="text-xs mt-1">Supports WAV, MP3, OGG (max 25MB)</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileAudio className="h-10 w-10 text-primary" />
                      <div className="text-left">
                        <p className="font-medium text-sm">{audio.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(audio.file.size)} • {formatDuration(audio.duration)}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearAll();
                      }}
                      disabled={isUploading}
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Remove file</span>
                    </Button>
                  </div>

                  {/* Audio Player */}
                  <div data-testid="audio-player" className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-3 mb-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="rounded-full h-10 w-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlayPause();
                        }}
                        disabled={isUploading}
                      >
                        {audio.isPlaying ? (
                          <Pause className="h-5 w-5" />
                        ) : (
                          <Play className="h-5 w-5" />
                        )}
                        <span className="sr-only">
                          {audio.isPlaying ? 'Pause' : 'Play'}
                        </span>
                      </Button>
                      
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{formatDuration(audio.currentTime)}</span>
                          <span>{formatDuration(audio.duration)}</span>
                        </div>
                        <div className="w-full">
                          <ProgressBar 
                            currentTime={audio.currentTime} 
                            duration={audio.duration} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Hidden audio element for playback */}
                  <audio
                    ref={audioRef}
                    src={audio.url || undefined}
                    onPlay={() => {
                      setAudio(prev => ({ ...prev, isPlaying: true }));
                      animationRef.current = requestAnimationFrame(updateTime);
                    }}
                    onPause={() => {
                      setAudio(prev => ({ ...prev, isPlaying: false }));
                      if (animationRef.current) {
                        cancelAnimationFrame(animationRef.current);
                      }
                    }}
                    onEnded={() => {
                      setAudio(prev => ({
                        ...prev,
                        isPlaying: false,
                        currentTime: 0,
                      }));
                      if (animationRef.current) {
                        cancelAnimationFrame(animationRef.current);
                      }
                    }}
                    onTimeUpdate={() => {
                      if (audioRef.current) {
                        setAudio(prev => ({
                          ...prev,
                          currentTime: audioRef.current?.currentTime || 0,
                        }));
                      }
                    }}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {/* Language Selection */}
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select 
                value={language} 
                onValueChange={setLanguage} 
                disabled={isUploading || !audio.file}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <Languages className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Select language" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sw">Swahili</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Uploading...</span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(uploadProgress)}%
                  </span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      cancelUpload();
                    }}
                    className="text-xs"
                  >
                    <X className="mr-1 h-3 w-3" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="submit"
                disabled={!audio.file || isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transcribing...
                  </>
                ) : (
                  'Transcribe Audio'
                )}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRecording(!isRecording)}
                className={cn(
                  'flex-1',
                  isRecording && 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                )}
                disabled={isUploading}
              >
                <Mic className={cn('mr-2 h-4 w-4', isRecording && 'animate-pulse')} />
                {isRecording ? 'Stop Recording' : 'Record Audio'}
              </Button>
            </div>

            {/* Transcription Result */}
            {result && (
              <div className="space-y-2">
                <Label htmlFor="transcription-result">Transcription Result</Label>
                <Textarea
                  id="transcription-result"
                  data-testid="transcription-result"
                  value={result}
                  readOnly
                  className="min-h-[140px]"
                />
              </div>
            )}
          </form>
        </CardContent>
        
        {/* API Settings Panel */}
        {isApiSettingsOpen && (
          <CardFooter className="bg-muted/50 border-t p-4">
            <div className="w-full space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="api-url">API Base URL</Label>
                  <span className="text-xs text-muted-foreground">
                    {baseUrl}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="api-url"
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrlState(e.target.value)}
                    placeholder="http://localhost:8000"
                    className="flex-1"
                  />
                  <Button type="button" onClick={onSaveBase}>
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter the base URL of your API server
                </p>
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <div className="text-sm text-muted-foreground">
                  Status: <span className="text-foreground font-medium">Connected</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsApiSettingsOpen(false)}
                >
                  Close Settings
                </Button>
              </div>
            </div>
          </CardFooter>
        )}
      </Card>
    </section>
  );
};

export default TranscribeForm;
