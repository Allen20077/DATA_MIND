from google import genai
import os
from groq import AsyncGroq
from app.core.config import settings
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(
    api_key=settings.gemini_api_key
)

groq_api_key = os.getenv("GROQ_API_KEY")

groq_client = (
    AsyncGroq(api_key=groq_api_key)
    if groq_api_key
    else None
)
GROQ_MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-120b"
)

async def generate_response(
    question: str,
    dataset_context: str | None = None
) -> str:

    if not settings.gemini_api_key:
        raise RuntimeError("Gemini API key is missing.")

    if not settings.gemini_model:
        raise RuntimeError("Gemini model is not configured.")

    system_instruction = """
    You are DataMind, a professional AI Data Scientist.

    Generate accurate, structured analytical reports.

    For uploaded datasets, explain:
    1. Executive summary
    2. Dataset structure
    3. Important statistical findings
    4. Data quality issues
    5. Correlations and potential outliers
    6. Business or practical implications
    7. Actionable recommendations

    For resumes, explain:
    1. Professional summary
    2. Detected skills
    3. Education and experience sections
    4. Projects and certifications
    5. Missing or unclear information
    6. Improvement recommendations

    For presentations and documents, explain:
    1. Executive summary
    2. Main topics
    3. Key findings
    4. Content gaps
    5. Recommendations

    Rules:
    - Use only the supplied evidence.
    - Never invent statistics, qualifications or findings.
    - Distinguish verified findings from assumptions.
    - Clearly state limitations.
    """

    if dataset_context:
        system_instruction += f"""

        Supplied context:
        {dataset_context}

        Do not claim to have inspected information
        that is absent from the supplied context.
        """

    try:
        response = await client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=question,
            config={
                "system_instruction": system_instruction
            }
        )

        answer = response.text or ""

        if not answer.strip():
            raise RuntimeError("Gemini returned an empty response.")

        return answer

    except Exception as gemini_error:
        status_code = (
            getattr(gemini_error, "code", None)
            or getattr(gemini_error, "status_code", None)
        )

        quota_exceeded = (
            status_code == 429
            or "RESOURCE_EXHAUSTED" in str(gemini_error)
        )

        if not quota_exceeded:
            raise

        print("Gemini quota reached. Switching to Groq.")

        if groq_client is None:
            raise RuntimeError(
                "Gemini quota reached, but GROQ_API_KEY is missing."
            ) from gemini_error

        try:
            groq_response = await groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": system_instruction
                    },
                    {
                        "role": "user",
                        "content": question
                    }
                ],
                temperature=0.3
            )

            answer = groq_response.choices[0].message.content

            if not answer:
                raise RuntimeError("Groq returned an empty response.")

            print("Groq fallback successful.")

            return answer

        except Exception as groq_error:
            print("\n========== GROQ API ERROR ==========")
            print(f"Model: {GROQ_MODEL}")
            print(f"Error type: {type(groq_error).__name__}")
            print(f"Error details: {groq_error}")
            print("====================================\n")
            raise
