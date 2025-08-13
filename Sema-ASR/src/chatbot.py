import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

# Check if GPU is available, otherwise use CPU
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

# Load Chatbot Model (DialoGPT by default)
def load_chatbot_model(model_name="microsoft/DialoGPT-medium"):
    """
    Load a conversational AI model.
    Options: "microsoft/DialoGPT-medium", "google/t5-small", or integrate with RASA.
    """
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name).to(device)
    return tokenizer, model

# Generate Chatbot Response
def generate_response(user_input, tokenizer, model, chat_history_ids=None, max_length=1000):
    """
    Generate a chatbot response using DialoGPT.
    Keeps track of conversation history.
    """
    new_input_ids = tokenizer.encode(user_input + tokenizer.eos_token, return_tensors="pt").to(device)

    bot_input_ids = torch.cat([chat_history_ids, new_input_ids], dim=-1) if chat_history_ids is not None else new_input_ids

    chat_history_ids = model.generate(bot_input_ids, max_length=max_length, pad_token_id=tokenizer.eos_token_id)

    return tokenizer.decode(chat_history_ids[:, bot_input_ids.shape[-1]:][0], skip_special_tokens=True), chat_history_ids

# Alternative: Use Hugging Face pipeline
chat_pipeline = pipeline("text-generation", model="microsoft/DialoGPT-medium", device=0 if torch.cuda.is_available() else -1)

if __name__ == "__main__":
    # Load model
    tokenizer, model = load_chatbot_model()
    print("✅ Chatbot Model Loaded Successfully!")

    chat_history = None
    while True:
        user_input = input("You: ")
        if user_input.lower() in ["exit", "quit", "bye"]:
            print("Chatbot: Kwaheri! 👋")
            break

        response, chat_history = generate_response(user_input, tokenizer, model, chat_history)
        print("Chatbot:", response)
