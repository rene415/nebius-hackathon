import os
import httpx
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv()

# Initialize Nebius client with a 10-second timeout
client = OpenAI(
    base_url="https://api.studio.nebius.ai/v1/",
    api_key=os.environ.get("NEBIUS_API_KEY"),
    timeout=httpx.Timeout(10.0, connect=5.0)
)

def test_connection():
    try:
        response = client.chat.completions.create(
            model="meta-llama/Llama-3.3-70B-Instruct",
            messages=[
                {"role": "user", "content": "Hello, respond with just the word OK"}
            ]
        )
        print(response.choices[0].message.content)
    except Exception as e:
        print(f"Error connecting to Nebius API: {e}")

if __name__ == "__main__":
    test_connection()
