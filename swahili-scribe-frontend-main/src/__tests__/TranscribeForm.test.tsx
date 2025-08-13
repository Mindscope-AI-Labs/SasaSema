import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TranscribeForm } from '../components/TranscribeForm';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the API module used by the component
vi.mock('@/lib/api', () => ({
  getBaseUrl: vi.fn(() => 'http://localhost:8000'),
  setBaseUrl: vi.fn(),
  postTranscribe: vi.fn().mockResolvedValue({
    text: 'Test transcription',
    language: 'sw',
    duration: 10.5,
  }),
  SUPPORTED_AUDIO_TYPES: ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg'],
  APIError: class APIError extends Error {
    code?: string;
    constructor(message: string, code?: string) { super(message); this.code = code; }
  },
}));

describe('TranscribeForm', () => {
  const mockAudioFile = new File(['audio content'], 'test.mp3', { type: 'audio/mp3' });
  
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    // Mock window.URL.createObjectURL
    window.URL.createObjectURL = vi.fn(() => 'blob:test-audio-url');
    // Mock global Audio to immediately fire loadedmetadata in JSDOM
    global.Audio = class MockAudio {
      public onloadedmetadata: (() => void) | null = null;
      public onerror: (() => void) | null = null;
      public duration = 12.34;
      constructor(_url: string) {
        setTimeout(() => {
          if (this.onloadedmetadata) this.onloadedmetadata();
        }, 0);
      }
      addEventListener(event: string, cb: () => void) {
        if (event === 'loadedmetadata') setTimeout(cb, 0);
      }
      removeEventListener() {}
      load() {}
      play() { return Promise.resolve(); }
      pause() {}
    } as unknown as typeof Audio;
  });

  it('renders the file upload area', () => {
    render(<TranscribeForm />);
    const dropZone = screen.getByTestId('drop-zone');
    expect(dropZone).toBeInTheDocument();
    expect(screen.getByText(/drag and drop your audio file here/i)).toBeInTheDocument();
  });

  it('handles file selection via button click', async () => {
    render(<TranscribeForm />);
    const fileInput = screen.getByTestId('file-input');
    
    fireEvent.change(fileInput, {
      target: { files: [mockAudioFile] },
    });

    // Check if the audio player is shown after file selection
    await waitFor(() => {
      expect(screen.getByTestId('audio-player')).toBeInTheDocument();
    });
  });

  it('shows error for unsupported file type', async () => {
    const unsupportedFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    render(<TranscribeForm />);
    const fileInput = screen.getByTestId('file-input');
    
    fireEvent.change(fileInput, {
      target: { files: [unsupportedFile] },
    });

    // Check if error message is shown
    await waitFor(() => {
      expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
    });
  });

  it('handles drag and drop of audio file', async () => {
    render(<TranscribeForm />);
    const dropZone = screen.getByTestId('drop-zone');
    
    fireEvent.dragEnter(dropZone);
    fireEvent.dragOver(dropZone, {
      dataTransfer: {
        files: [mockAudioFile],
        types: ['Files'],
      },
    });
    
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [mockAudioFile],
      },
    });

    // Check if the audio player is shown after drop
    await waitFor(() => {
      expect(screen.getByTestId('audio-player')).toBeInTheDocument();
    });
  });

  it('submits the form and shows transcription result', async () => {
    render(<TranscribeForm />);
    
    // Simulate file selection
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [mockAudioFile] } });
    
    // Wait for audio player to be visible
    await waitFor(() => {
      expect(screen.getByTestId('audio-player')).toBeInTheDocument();
    });
    
    // Click the transcribe button
    const transcribeButton = screen.getByRole('button', { name: /transcribe audio/i });
    fireEvent.click(transcribeButton);
    
    // Check if loading state is shown
    expect(screen.getByText(/transcribing\.{3}|transcribing/i)).toBeInTheDocument();
    
    // Wait for transcription to complete
    await waitFor(() => {
      // Result should appear in the results textarea/display
      expect(screen.getByDisplayValue(/test transcription/i)).toBeInTheDocument();
    });
  });
});
