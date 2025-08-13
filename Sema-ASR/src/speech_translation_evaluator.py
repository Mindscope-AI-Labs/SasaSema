import os
import torch
import librosa
import evaluate
import matplotlib.pyplot as plt
from transformers import (
    Wav2Vec2ForCTC, Wav2Vec2Processor,
    MT5ForConditionalGeneration, MT5Tokenizer
)
import ipywidgets as widgets
from IPython.display import display, HTML, Audio
import io
import soundfile as sf

class SpeechTranslationEvaluator:
    def __init__(self):
        # Initialize device
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Initialize models and metrics
        self.setup_models()
        self.setup_metrics()
        
        # Create and display widgets
        self.create_widgets()
        self.display_interface()
        
    def setup_models(self):
        """Initialize ASR and Translation models"""
        try:
            print(f"Loading models on {self.device}...")
            
            # ASR Model
            self.asr_model_path = "models/asr/wav2vec2-sw"
            self.asr_model = Wav2Vec2ForCTC.from_pretrained(self.asr_model_path).to(self.device)
            self.asr_processor = Wav2Vec2Processor.from_pretrained(self.asr_model_path)
            
            # Translation Model
            self.translation_model = MT5ForConditionalGeneration.from_pretrained("google/mt5-small").to(self.device)
            self.translation_tokenizer = MT5Tokenizer.from_pretrained("google/mt5-small")
            
            print("Models loaded successfully!")
            
        except Exception as e:
            print(f"Error loading models: {str(e)}")
            raise
            
    def setup_metrics(self):
        """Initialize evaluation metrics"""
        self.wer_metric = evaluate.load("wer")
        self.bleu_metric = evaluate.load("bleu")
        self.rouge_metric = evaluate.load("rouge")
        
    def create_widgets(self):
        """Create interface widgets"""
        # File upload
        self.upload_widget = widgets.FileUpload(
            accept='.wav',
            multiple=False,
            description='Upload WAV',
            layout=widgets.Layout(width='300px')
        )
        
        # Reference text inputs
        self.sw_reference = widgets.Textarea(
            placeholder='Enter Swahili reference text...',
            description='Swahili:',
            layout=widgets.Layout(width='500px', height='100px')
        )
        
        self.en_reference = widgets.Textarea(
            placeholder='Enter English reference text...',
            description='English:',
            layout=widgets.Layout(width='500px', height='100px')
        )
        
        # Process button
        self.process_button = widgets.Button(
            description='Evaluate',
            disabled=True,
            button_style='primary',
            layout=widgets.Layout(width='150px')
        )
        
        # Output displays
        self.audio_player = widgets.HTML(value="No audio uploaded")
        self.results_output = widgets.Output()
        self.progress = widgets.FloatProgress(
            value=0,
            min=0,
            max=100,
            description='Processing:',
            bar_style='info'
        )
        self.status_message = widgets.HTML(value="")
        
        # Connect callbacks
        self.upload_widget.observe(self.on_upload_change, names='value')
        self.process_button.on_click(self.on_process_click)
        
    def display_interface(self):
        """Display the complete interface"""
        display(HTML("<h2>Speech Translation Evaluation System</h2>"))
        
        # Layout widgets
        upload_section = widgets.VBox([
            self.upload_widget,
            self.audio_player,
            self.status_message
        ])
        
        reference_section = widgets.VBox([
            self.sw_reference,
            self.en_reference,
            self.process_button
        ])
        
        results_section = widgets.VBox([
            self.progress,
            self.results_output
        ])
        
        # Display all sections
        display(upload_section)
        display(reference_section)
        display(results_section)
        
    def on_upload_change(self, change):
        """Handle file upload changes"""
        if change.new:
            uploaded_file = next(iter(change.new.values()))
            
            # Create audio player
            audio_html = Audio(uploaded_file['content'], autoplay=False)
            self.audio_player.value = audio_html._repr_html_()
            
            # Enable process button if references are provided
            self.update_button_state()
            
            self.status_message.value = f"<span style='color: green'>File uploaded: {uploaded_file['metadata']['name']}</span>"
        else:
            self.process_button.disabled = True
            self.audio_player.value = "No audio uploaded"
            self.status_message.value = ""
            
    def update_button_state(self):
        """Update process button state based on inputs"""
        has_audio = len(self.upload_widget.value) > 0
        has_references = len(self.sw_reference.value.strip()) > 0 and len(self.en_reference.value.strip()) > 0
        self.process_button.disabled = not (has_audio and has_references)
        
    def on_process_click(self, b):
        """Handle evaluation process"""
        try:
            # Clear previous results
            self.results_output.clear_output()
            
            # Get uploaded file
            uploaded_file = next(iter(self.upload_widget.value.values()))
            audio_content = uploaded_file['content']
            audio_stream = io.BytesIO(audio_content)
            
            # Update progress
            self.progress.value = 10
            
            # Load and process audio
            speech, _ = librosa.load(audio_stream, sr=16000)
            self.progress.value = 30
            
            # Run evaluation
            results = self.evaluate_pipeline(
                speech,
                self.sw_reference.value,
                self.en_reference.value
            )
            
            # Display results
            with self.results_output:
                self.visualize_metrics(results)
            
            self.progress.value = 100
            self.status_message.value = "<span style='color: green'>Evaluation complete!</span>"
            
        except Exception as e:
            self.status_message.value = f"<span style='color: red'>Error: {str(e)}</span>"
            self.progress.value = 0
            
    def evaluate_pipeline(self, audio, sw_reference, en_reference):
        """Run the evaluation pipeline"""
        # ASR
        inputs = self.asr_processor(audio, sampling_rate=16000, return_tensors="pt", padding=True).to(self.device)
        self.progress.value = 50
        
        with torch.no_grad():
            logits = self.asr_model(**inputs).logits
        predicted_ids = torch.argmax(logits, dim=-1)
        transcription = self.asr_processor.batch_decode(predicted_ids)[0].lower()
        
        self.progress.value = 70
        
        # Translation
        input_text = f"translate Swahili to English: {transcription}"
        trans_inputs = self.translation_tokenizer(input_text, return_tensors="pt", padding=True).to(self.device)
        
        with torch.no_grad():
            output_ids = self.translation_model.generate(**trans_inputs)
        translation = self.translation_tokenizer.decode(output_ids[0], skip_special_tokens=True)
        
        self.progress.value = 90
        
        # Compute metrics
        wer = self.wer_metric.compute(predictions=[transcription], references=[sw_reference])
        bleu = self.bleu_metric.compute(predictions=[translation], references=[[en_reference]])
        rouge = self.rouge_metric.compute(predictions=[translation], references=[en_reference])
        
        return {
            "wer": wer,
            "bleu": bleu,
            "rouge": rouge,
            "transcription": transcription,
            "translation": translation,
            "sw_reference": sw_reference,
            "en_reference": en_reference
        }
        
    def visualize_metrics(self, results):
        """Display evaluation results"""
        # Plot metrics
        wer = results["wer"]
        bleu = results["bleu"]["bleu"]
        rouge = results["rouge"]["rougeL"]
        
        metrics = ['WER (↓)', 'BLEU (↑)', 'ROUGE-L (↑)']
        values = [wer, bleu, rouge]
        
        plt.figure(figsize=(8, 5))
        bars = plt.bar(metrics, values, color=["tomato", "steelblue", "forestgreen"])
        plt.title("ASR & Translation Evaluation Metrics", fontsize=14)
        plt.ylim(0, 1)
        
        for bar in bars:
            yval = bar.get_height()
            plt.text(bar.get_x() + bar.get_width()/2.0, yval + 0.02, 
                    f'{yval:.2f}', ha='center', fontsize=12)
        
        plt.tight_layout()
        plt.show()
        
        # Print text results
        print("\n--- Evaluation Summary ---")
        print(f"🗣️  Transcription: {results['transcription']}")
        print(f"🌍 Translation:    {results['translation']}")
        print(f"🧾 SW Reference:   {results['sw_reference']}")
        print(f"🧾 EN Reference:   {results['en_reference']}")

# Create and display the evaluator
def create_evaluator():
    return SpeechTranslationEvaluator()
