import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline

# Check if GPU is available, otherwise use CPU
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

# Load Translation Model
def load_translation_model(model_name="facebook/nllb-200-distilled-600M"):
    """
    Load a pre-trained translation model for Swahili ↔ English.
    Options: "facebook/nllb-200-distilled-600M", "facebook/m2m100_418M", "facebook/mbart-large-50"
    """
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name).to(device)
    return tokenizer, model

# Translate Text
def translate_text(text, tokenizer, model, src_lang="swh", tgt_lang="eng", max_length=256):
    """
    Translate text from Swahili to English or vice versa.
    Language codes:
    - Swahili: 'swh'
    - English: 'eng'
    """
    inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True).to(device)

    with torch.no_grad():
        outputs = model.generate(**inputs, max_length=max_length, forced_bos_token_id=tokenizer.lang_code_to_id[tgt_lang])

    return tokenizer.decode(outputs[0], skip_special_tokens=True)

# Load Pre-trained Pipeline (Alternative)
translation_pipeline = pipeline("translation", model="facebook/m2m100_418M", device=0 if torch.cuda.is_available() else -1)

if __name__ == "__main__":
    # Load model & tokenizer
    tokenizer, model = load_translation_model()
    print("✅ Translation Model Loaded Successfully!")

    # Example Text
    swahili_text = "Lugha ya Kiswahili ni muhimu sana kwa kuunganisha Afrika."
    
    # Swahili → English Translation
    translated_to_english = translate_text(swahili_text, tokenizer, model, src_lang="swh", tgt_lang="eng")
    print("Translated to English:", translated_to_english)

    # English → Swahili Translation
    english_text = "Swahili is an important language for uniting Africa."
    translated_to_swahili = translate_text(english_text, tokenizer, model, src_lang="eng", tgt_lang="swh")
    print("Translated to Swahili:", translated_to_swahili)

    # Alternative Translation using M2M-100
    translated_m2m = translation_pipeline(swahili_text, src_lang="sw", tgt_lang="en")
    print("M2M-100 Translation:", translated_m2m[0]['translation_text'])
