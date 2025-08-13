import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline

# Check if GPU is available, otherwise use CPU
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

# Load Text Models
def load_text_model(model_name="google/mt5-small"):
    """
    Load a pre-trained text-to-text model for paraphrasing, summarization, and text processing.
    """
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name).to(device)
    return tokenizer, model

# Paraphrase Text
def paraphrase_text(text, tokenizer, model, max_length=256):
    """
    Generate a paraphrased version of the input text using the model.
    """
    input_text = f"paraphrase: {text}"
    inputs = tokenizer(input_text, return_tensors="pt", padding=True, truncation=True).to(device)
    
    with torch.no_grad():
        outputs = model.generate(**inputs, max_length=max_length)
    
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

# Summarize Text
def summarize_text(text, tokenizer, model, max_length=128):
    """
    Summarize the input text using the model.
    """
    input_text = f"summarize: {text}"
    inputs = tokenizer(input_text, return_tensors="pt", padding=True, truncation=True).to(device)
    
    with torch.no_grad():
        outputs = model.generate(**inputs, max_length=max_length)
    
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

# Load Pre-trained Pipeline (Alternative)
summarization_pipeline = pipeline("summarization", model="facebook/bart-large-cnn", device=0 if torch.cuda.is_available() else -1)

if __name__ == "__main__":
    # Load model & tokenizer
    tokenizer, model = load_text_model()
    print("✅ Text Processing Model Loaded Successfully!")

    # Example Text
    sample_text = "Swahili is one of the most spoken languages in Africa, and its expansion can help unify the continent."

    # Paraphrasing
    paraphrased = paraphrase_text(sample_text, tokenizer, model)
    print("Paraphrased Text:", paraphrased)

    # Summarization
    summarized = summarize_text(sample_text, tokenizer, model)
    print("Summarized Text:", summarized)

    # Alternative Summarization using BART
    summarized_bart = summarization_pipeline(sample_text, max_length=50, min_length=10, do_sample=False)
    print("BART Summarization:", summarized_bart[0]['summary_text'])
