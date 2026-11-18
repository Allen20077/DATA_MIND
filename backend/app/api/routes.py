from fastapi import APIRouter, HTTPException, UploadFile, File
from pathlib import Path
from uuid import UUID, uuid4
import io
import re
import json
import traceback
import pandas as pd
from pydantic import BaseModel, Field
from app.services.document_service import (
    extract_document,
    SUPPORTED_EXTENSIONS,
)
from google.genai.errors import ServerError
from app.services.llm_service import generate_response
from app.core.config import settings
import math

def safe_number(value):
    if pd.isna(value):
        return None

    number = float(value)

    return number if math.isfinite(number) else None
router = APIRouter()


RESUME_SKILLS = {
    "Programming": [
        "python", "java", "javascript", "typescript", "c++",
        "sql", "r", "html", "css"
    ],
    "Data Science": [
        "machine learning", "deep learning", "data science",
        "pandas", "numpy", "scikit-learn", "tensorflow",
        "pytorch", "statistics", "data analysis"
    ],
    "Visualization": [
        "power bi", "tableau", "matplotlib", "seaborn",
        "plotly", "excel"
    ],
    "Databases": [
        "mysql", "postgresql", "mongodb", "sqlite",
        "oracle", "database management"
    ],
    "Cloud and Tools": [
        "aws", "azure", "google cloud", "docker",
        "git", "github", "linux", "fastapi", "react"
    ],
}


def build_resume_analysis(text: str) -> dict:
    normalized = text.lower()

    skills_by_category = {}

    for category, skills in RESUME_SKILLS.items():
        found = [
            skill
            for skill in skills
            if re.search(
                r"(?<![a-z0-9])" + re.escape(skill) + r"(?![a-z0-9])",
                normalized
            )
        ]
        skills_by_category[category] = found

    all_skills = [
        skill
        for skills in skills_by_category.values()
        for skill in skills
    ]

    section_patterns = {
        "contact": r"\b(contact|email|phone|linkedin)\b",
        "summary": r"\b(professional summary|profile|career objective|objective)\b",
        "education": r"\b(education|academic background|qualifications)\b",
        "experience": r"\b(experience|employment history|work history)\b",
        "projects": r"\b(projects|personal projects|academic projects)\b",
        "certifications": r"\b(certifications|certificates|licenses)\b",
        "skills": r"\b(technical skills|skills|core competencies)\b",
    }

    sections = {
        name: bool(re.search(pattern, normalized))
        for name, pattern in section_patterns.items()
    }

    missing_sections = [
        name for name, found in sections.items()
        if not found
    ]

    project_count = len(re.findall(
        r"(?im)^\s*(?:project(?:\s+\d+)?|project title)\s*[:\-]",
        text
    ))

    certification_count = len(re.findall(
        r"(?im)^\s*(?:certification|certificate)\s*[:\-]",
        text
    ))

    date_patterns = re.findall(
        r"\b(?:19|20)\d{2}\b",
        text
    )

    recommendations = []

    if not sections["summary"]:
        recommendations.append(
            "Consider adding a concise professional summary."
        )

    if not sections["experience"]:
        recommendations.append(
            "Add a clearly labelled experience section if applicable."
        )

    if not sections["projects"]:
        recommendations.append(
            "Add a projects section with measurable outcomes where applicable."
        )

    if not sections["certifications"]:
        recommendations.append(
            "Include relevant certifications if you hold any."
        )

    if not all_skills:
        recommendations.append(
            "Use a clearly labelled skills section to make technical capabilities easier to identify."
        )

    return {
        "skills_total": len(all_skills),
        "skills_by_category": skills_by_category,
        "skills_chart": [
            {
                "category": category,
                "count": len(skills)
            }
            for category, skills in skills_by_category.items()
        ],
        "sections_detected": sections,
        "missing_sections": missing_sections,
        "project_count": project_count,
        "certification_count": certification_count,
        "date_mentions": list(dict.fromkeys(date_patterns)),
        "date_mentions_count": len(set(date_patterns)),
        "word_count": len(text.split()),
        "character_count": len(text),
        "recommendations": recommendations,
    }

DATASET_DIR = Path(__file__).resolve().parents[2] / "uploads"
DATASET_DIR.mkdir(parents=True, exist_ok=True)

class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    dataset_context: str | None = Field(default=None, max_length=12000) 


@router.get("/health")
async def health():
    return {
        "status": "healthy",
        "provider": "Google Gemini"
    }
@router.get("/datasets/{dataset_id}/analysis")
async def analyze_dataset(dataset_id: str):

    try:
        dataset_uuid = str(UUID(dataset_id))
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid dataset ID."
        )

    file_path = DATASET_DIR / f"{dataset_uuid}.csv"

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Dataset not found."
        )

    try:
        df = pd.read_csv(file_path)

        numeric_df = df.select_dtypes(include="number")

        statistics = {}

        for column in numeric_df.columns:
            series = numeric_df[column]

            statistics[column] = {
                "mean": safe_number(series.mean()),
                "median": safe_number(series.median()),
                "minimum": safe_number(series.min()),
                "maximum": safe_number(series.max()),
                "std": safe_number(series.std())
            }

        return {
            "dataset_id": dataset_uuid,
            "rows": len(df),
            "columns": len(df.columns),
            "missing_by_column": {
                str(k): int(v)
                for k, v in df.isnull().sum().items()
            },
            "duplicate_rows": int(df.duplicated().sum()),
            "numeric_statistics": statistics
        }

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Dataset analysis failed."
        )
@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    allowed_extensions = {".csv", ".xlsx"}

    extension = Path(file.filename or "").suffix.lower()

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Only CSV and XLSX files are supported currently."
        )

    content = await file.read()

    max_size = settings.max_upload_mb * 1024 * 1024

    if len(content) > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {settings.max_upload_mb} MB limit."
        )

    if not content:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty."
        )

    dataset_id = str(uuid4())
    saved_path = DATASET_DIR / f"{dataset_id}{extension}"

    try:
        if extension == ".csv":
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content), engine="openpyxl")

        df.to_csv(saved_path.with_suffix(".csv"), index=False)

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Unable to read this file. Check that it is a valid CSV or XLSX file."
        )

    return {
        "dataset_id": dataset_id,
        "filename": file.filename,
        "rows": len(df),
        "columns": len(df.columns),
        "column_names": df.columns.tolist(),
        "missing_values": int(df.isnull().sum().sum()),
        "duplicates": int(df.duplicated().sum()),
        "preview": df.head(10).fillna("").to_dict(orient="records")
    }
@router.post("/chat")
async def chat(request: ChatRequest):
    try:
        answer = await generate_response(
            request.question,
            request.dataset_context
        )

        if not answer.strip():
            raise HTTPException(
                status_code=502,
                detail="The AI service returned an empty response."
            )

        return {
            "success": True,
            "question": request.question,
            "answer": answer,
            "provider": "DataMind"
        }

    except HTTPException:
        raise

    except Exception as error:
        print("\n========== CHAT API ERROR ==========")
        print(f"Error type: {type(error).__name__}")
        print(f"Error details: {error}")
        print("====================================\n")

        error_code = getattr(error, "code", None)

        if error_code == 429:
            raise HTTPException(
                status_code=429,
                detail=(
                    "The AI request quota has been reached. "
                    "Please try again after your API quota resets."
                )
            )

        raise HTTPException(
            status_code=502,
            detail=(
                "DataMind could not generate an answer. "
                "Check the backend logs for details."
            )
        )

@router.post("/documents/analyze")
async def analyze_document(file: UploadFile = File(...)):
    filename = file.filename or "unknown"
    extension = Path(filename).suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format: {extension}"
        )

    max_bytes = settings.max_upload_mb * 1024 * 1024
    data = await file.read(max_bytes + 1)

    if len(data) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {settings.max_upload_mb} MB limit."
        )

    if not data:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty."
        )

    try:
        result = extract_document(filename, data)

        extracted_text = result.get("text", "") or ""
        analysis = result.get("analysis", {}) or {}

        analysis_type = "document"
        resume_analysis = None
        insights = []
        recommendations = []

        # Detect the analysis route from the uploaded format.
        if extension in {".csv", ".xlsx", ".xls"}:
            analysis_type = "dataset"

        elif extension == ".json":
            analysis_type = (
                "dataset"
                if "rows" in analysis and "columns" in analysis
                else "structured_data"
            )

        elif extension in {".pdf", ".docx"}:
            normalized_text = extracted_text.lower()

            resume_markers = [
                "curriculum vitae",
                "professional experience",
                "work experience",
                "employment history",
                "technical skills",
                "education",
                "career objective",
            ]

            marker_count = sum(
                marker in normalized_text
                for marker in resume_markers
            )

            if marker_count >= 2:
                analysis_type = "resume"
                resume_analysis = build_resume_analysis(
                    extracted_text
                )

        elif extension == ".pptx":
            analysis_type = "presentation"

        elif extension == ".txt":
            analysis_type = "text"

        # Deterministic document metrics.
        text_metrics = {
            "character_count": len(extracted_text),
            "word_count": len(extracted_text.split()),
            "line_count": len(extracted_text.splitlines()),
        }

        if not extracted_text.strip() and extension in {
            ".pdf", ".docx", ".pptx", ".txt"
        }:
            insights.append(
                "No readable text was extracted from this file. "
                "It may contain scanned pages or image-based content."
            )

        # Dataset findings based on calculated extraction results.
        if analysis_type == "dataset":
            if "rows" in analysis:
                rows = analysis.get("rows", 0)
                columns = analysis.get("columns", 0)
                missing = analysis.get("missing_values", 0)
                duplicates = analysis.get("duplicate_rows", 0)

                insights.append(
                    f"The dataset contains {rows:,} rows "
                    f"and {columns:,} columns."
                )

                insights.append(
                    f"Detected {missing:,} missing values "
                    f"and {duplicates:,} duplicate rows."
                )

                if missing:
                    recommendations.append(
                        "Review missing values before modelling "
                        "or drawing statistical conclusions."
                    )

                if duplicates:
                    recommendations.append(
                        "Investigate duplicate rows and remove them "
                        "if they are unintended."
                    )

                # Identify columns with potential outliers.
                outlier_counts = analysis.get("outlier_counts", {})

                for column, count in outlier_counts.items():
                    if count > 0:
                        insights.append(
                            f"Column '{column}' contains "
                            f"{count} potential outliers using "
                            "the IQR method."
                        )

                # Identify strong numeric correlations.
                correlations = analysis.get(
                    "correlation_matrix", {}
                )

                correlated_pairs = []

                for column_a, values in correlations.items():
                    for column_b, correlation in values.items():
                        if column_a >= column_b:
                            continue

                        if (
                            correlation is not None
                            and abs(correlation) >= 0.7
                        ):
                            correlated_pairs.append({
                                "column_a": column_a,
                                "column_b": column_b,
                                "correlation": correlation,
                            })

                for pair in correlated_pairs:
                    direction = (
                        "positive"
                        if pair["correlation"] > 0
                        else "negative"
                    )

                    insights.append(
                        f"'{pair['column_a']}' and "
                        f"'{pair['column_b']}' have a strong "
                        f"{direction} correlation "
                        f"({pair['correlation']:.2f}). "
                        "Correlation does not establish causation."
                    )

                if analysis.get("missing_percentage", 0) > 20:
                    recommendations.append(
                        "More than 20% of dataset cells are missing. "
                        "Investigate the missing-data mechanism before "
                        "choosing an imputation strategy."
                    )

            elif "sheets" in analysis:
                insights.append(
                    f"The workbook contains "
                    f"{analysis.get('sheet_count', 0)} worksheets."
                )

                for sheet_name, sheet in analysis["sheets"].items():
                    if "rows" in sheet:
                        insights.append(
                            f"Worksheet '{sheet_name}' contains "
                            f"{sheet.get('rows', 0)} rows and "
                            f"{sheet.get('columns', 0)} columns."
                        )

        # Resume findings.
        if resume_analysis:
            insights.append(
                f"Detected {resume_analysis['skills_total']} "
                "skills from the configured skill dictionary."
            )

            insights.append(
                f"Detected {len(resume_analysis['missing_sections'])} "
                "potentially missing resume sections."
            )

            recommendations.extend(
                resume_analysis["recommendations"]
            )

        # Presentation findings.
        if analysis_type == "presentation":
            insights.append(
                f"The presentation contains "
                f"{analysis.get('slide_count', 0)} slides."
            )

            if not extracted_text.strip():
                recommendations.append(
                    "Check whether the slides contain text embedded "
                    "inside images."
                )

        # General text/document findings.
        if analysis_type in {"document", "text", "structured_data"}:
            insights.append(
                f"Extracted {text_metrics['word_count']:,} words "
                f"and {text_metrics['character_count']:,} characters."
            )

            if not extracted_text.strip():
                recommendations.append(
                    "Check whether the document is scanned or image-based. "
                    "OCR may be required."
                )

        # Gemini interprets extracted evidence; Python findings remain
        # available even when the AI provider is unavailable.
        context = {
            "filename": filename,
            "file_type": extension,
            "analysis_type": analysis_type,
            "analysis": analysis,
            "resume_analysis": resume_analysis,
            "text_metrics": text_metrics,
            "extracted_text": extracted_text[:25000],
        }

        prompt = (
            "You are DataMind, a professional data scientist "
            "and document analyst. Analyze the supplied evidence. "
            "Return a structured report with these headings: "
            "Executive Summary, Key Findings, Detailed Analysis, "
            "Limitations, and Recommendations. "
            "For datasets, discuss only statistics present in the data. "
            "For resumes, distinguish detected skills and sections "
            "from actual experience or proficiency. "
            "For presentations, assess the supplied slide content. "
            "For other documents, identify the main topics and findings. "
            "Never invent statistics, qualifications, dates, or facts. "
            "If evidence is insufficient, state that clearly.\n\n"
            + json.dumps(
                context,
                ensure_ascii=False,
                default=str
            )
        )

        ai_status = "available"
        ai_summary = ""

        try:
            ai_summary = await generate_response(prompt)

            if not ai_summary:
                ai_status = "unavailable"
                ai_summary = (
                    "Gemini returned an empty response. "
                    "The extracted analysis is still available."
                )

        except Exception as error:
            print(f"Gemini analysis unavailable: {error}")

            error_code = getattr(error, "code", None)

            if error_code == 429:
                ai_status = "quota_exceeded"
                ai_summary = (
                    "Your Gemini API daily request quota has been reached. "
                    "AI interpretation will become available again when "
                    "your quota resets. Your Python-generated analysis "
                    "and visualizations are unaffected."
                )
            else:
                ai_status = "unavailable"
                ai_summary = (
                    "AI interpretation is temporarily unavailable. "
                    "Your Python-generated analysis and visualizations "
                    "are still available."
                )

        return {
            "success": True,
            "filename": filename,
            "file_type": extension,
            "analysis_type": analysis_type,
            "analysis": analysis,
            "resume_analysis": resume_analysis,
            "text_metrics": text_metrics,
            "insights": insights,
            "recommendations": recommendations,
            "extracted_text_preview": extracted_text[:3000],
            "ai_summary": ai_summary,
            "ai_status": ai_status,
        }

    except (ValueError, UnicodeError) as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except Exception as error:
        print("\n========== DOCUMENT ANALYSIS ERROR ==========")
        traceback.print_exc()
        print("==============================================\n")

        raise HTTPException(
            status_code=500,
            detail=(
                f"Document analysis failed: "
                f"{type(error).__name__}: {str(error)}"
            )
        )
