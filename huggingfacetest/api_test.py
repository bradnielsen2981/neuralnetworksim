import os
from openai import OpenAI

HF_TOKEN = "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"

client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_TOKEN
)

completion = client.chat.completions.create(
    model="HuggingFaceTB/SmolLM3-3B:hf-inference",
    messages=[
        {
            "role": "user",
            "content": "What is the capital of France?"
        }
    ],
)

print(completion.choices[0].message)