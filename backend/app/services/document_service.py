
import io
import json
from pathlib import Path
import re
import pandas as pd
from docx import Document
from pptx import Presentation
from pypdf import PdfReader

SUPPORTED_EXTENSIONS = {
    ".csv", ".xlsx", ".xls", ".json",
    ".txt", ".docx", ".pptx", ".pdf"
}

import warnings

warnings.filterwarnings(
    "ignore",
    message="Conditional Formatting extension is not supported",
    category=UserWarning,
    module="openpyxl"
)

def is_identifier_column(column: str, series: pd.Series) -> bool:
    """Detect numeric columns that represent identifiers, not measurements."""

    name = re.sub(r"[^a-z0-9]+", " ", str(column).lower()).strip()

    identifier_patterns = [
        r"\bphone\b",
        r"\bmobile\b",
        r"\btelephone\b",
        r"\btelephone number\b",
        r"\bcontact number\b",
        r"\bphone number\b",
        r"\bmobile number\b",
        r"\bcustomer id\b",
        r"\buser id\b",
        r"\bemployee id\b",
        r"\bstudent id\b",
        r"\baccount number\b",
        r"\baccount no\b",
        r"\border id\b",
        r"\binvoice id\b",
        r"\btransaction id\b",
        r"\brecord id\b",
        r"\bpostal code\b",
        r"\bzip code\b",
        r"\bpincode\b",
        r"\bpin code\b",
        r"\bpassport number\b",
        r"\bregistration number\b",
    ]

    if any(re.search(pattern, name) for pattern in identifier_patterns):
        return True

    # Generic ID column names.
    if re.search(r"(^| )id($| )", name):
        return True

    # Detect long integer-like values that are likely identifiers.
    values = pd.to_numeric(series, errors="coerce").dropna()

    if len(values) >= 5:
        integer_values = values[values.mod(1).eq(0)]

        if len(integer_values) / len(values) >= 0.9:
            digit_lengths = integer_values.abs().astype("int64").astype(str).str.len()

            if (digit_lengths >= 9).mean() >= 0.9:
                return True

    return False

def analyze_dataframe(df: pd.DataFrame) -> dict:
    df = df.copy()
    df = df.replace([float("inf"), float("-inf")], float("nan"))

    row_count = len(df)
    column_count = len(df.columns)

    if column_count == 0:
        return {
            "rows": row_count,
            "columns": 0,
            "column_names": [],
            "missing_values": 0,
            "missing_percentage": 0,
            "missing_by_column": {},
            "duplicate_rows": 0,
            "duplicate_percentage": 0,
            "numeric_statistics": {},
            "correlation_matrix": {},
            "outlier_counts": {},
            "column_profiles": [],
            "preview": [],
        }

    missing_by_column = df.isna().sum()
    missing_values = int(missing_by_column.sum())

    duplicate_rows = int(df.duplicated().sum())

    missing_percentage = (
        round((missing_values / (row_count * column_count)) * 100, 2)
        if row_count and column_count else 0
    )

    duplicate_percentage = (
        round((duplicate_rows / row_count) * 100, 2)
        if row_count else 0
    )

    identifier_columns = [
        column
        for column in df.columns
        if is_identifier_column(str(column), df[column])
    ]

    numeric = df.select_dtypes(include="number").drop(
        columns=identifier_columns,
        errors="ignore"
    )

    # Descriptive statistics for numeric columns.
    if not numeric.empty:
        numeric_statistics = json.loads(
            numeric.describe().round(3).to_json()
        )

        # Correlations between numeric columns.
        if len(numeric.columns) >= 2:
            correlation_matrix = json.loads(
                numeric.corr().round(3).to_json()
            )
        else:
            correlation_matrix = {}

        # IQR-based outlier counts.
        outlier_counts = {}

        for column in numeric.columns:
            series = numeric[column].dropna()

            if series.empty:
                outlier_counts[str(column)] = 0
                continue

            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1

            lower_bound = q1 - (1.5 * iqr)
            upper_bound = q3 + (1.5 * iqr)

            count = int(
                ((series < lower_bound) | (series > upper_bound)).sum()
            )

            outlier_counts[str(column)] = count

    else:
        numeric_statistics = {}
        correlation_matrix = {}
        outlier_counts = {}

    # Profile every column.
    column_profiles = []

    for column in df.columns:
        series = df[column]
        missing_count = int(series.isna().sum())

        profile = {
            "column": str(column),
            "data_type": str(series.dtype),
            "missing_count": missing_count,
            "missing_percentage": (
                round((missing_count / row_count) * 100, 2)
                if row_count else 0
            ),
            "unique_values": int(series.nunique(dropna=True)),
        }

        profile["column_type"] = (
            "identifier" if column in identifier_columns
            else "numeric" if column in numeric.columns
            else "categorical"
        )

        if column in numeric.columns:
            clean_series = series.dropna()

            if not clean_series.empty:
                profile["mean"] = float(clean_series.mean())
                profile["median"] = float(clean_series.median())
                profile["minimum"] = float(clean_series.min())
                profile["maximum"] = float(clean_series.max())

        else:
            top_values = series.value_counts(
                dropna=True
            ).head(5)

            profile["top_values"] = [
                {
                    "value": str(value),
                    "count": int(count),
                }
                for value, count in top_values.items()
            ]

        column_profiles.append(profile)

    # Histogram data for numeric columns.
    numeric_distributions = {}

    for column in numeric.columns:
        series = numeric[column].dropna()

        if series.empty:
            continue

        if series.nunique() == 1:
            numeric_distributions[str(column)] = [
                {
                    "range": str(series.iloc[0]),
                    "count": int(len(series)),
                }
            ]
            continue

        bins = pd.cut(series, bins=10, duplicates="drop")
        counts = bins.value_counts(sort=False)

        numeric_distributions[str(column)] = [
            {
                "range": str(interval),
                "count": int(count),
            }
            for interval, count in counts.items()
        ]

    preview = json.loads(
        df.head(10).to_json(
            orient="records",
            date_format="iso"
        )
    )

    return {
        "rows": row_count,
        "columns": column_count,
        "column_names": [str(column) for column in df.columns],
        "missing_values": missing_values,
        "missing_percentage": missing_percentage,
        "missing_by_column": {
            str(column): int(count)
            for column, count in missing_by_column.items()
        },
        "duplicate_rows": duplicate_rows,
        "duplicate_percentage": duplicate_percentage,
        "numeric_statistics": numeric_statistics,
        "numeric_columns": [str(column) for column in numeric.columns],
        "identifier_columns": [str(column) for column in identifier_columns],
        "correlation_matrix": correlation_matrix,
        "outlier_counts": outlier_counts,
        "column_profiles": column_profiles,
        "numeric_distributions": numeric_distributions,
        "preview": preview,
    }


def extract_document(filename: str, data: bytes) -> dict:
    extension = Path(filename).suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported format: {extension}")

    result = {
        "filename": filename,
        "file_type": extension,
        "text": "",
        "analysis": {},
    }

    if extension == ".csv":
        df = pd.read_csv(io.BytesIO(data))
        result["analysis"] = analyze_dataframe(df)

    elif extension in {".xlsx", ".xls"}:
        workbook = pd.ExcelFile(io.BytesIO(data))
        sheets = {}

        for sheet_name in workbook.sheet_names:
            df = pd.read_excel(
                workbook,
                sheet_name=sheet_name
            )

            if df.empty and len(df.columns) == 0:
                sheets[sheet_name] = {
                    "rows": 0,
                    "columns": 0,
                    "message": "This sheet contains no usable data."
                }
            else:
                sheets[sheet_name] = analyze_dataframe(df)

        result["analysis"] = {
            "sheet_count": len(sheets),
            "sheets": sheets
        }

    elif extension == ".json":
        obj = json.loads(data.decode("utf-8-sig"))

        if isinstance(obj, list) and all(
            isinstance(item, dict) for item in obj
        ):
            result["analysis"] = analyze_dataframe(
                pd.DataFrame(obj)
            )
        else:
            result["text"] = json.dumps(
                obj, ensure_ascii=False, indent=2
            )

    elif extension == ".txt":
        result["text"] = data.decode("utf-8-sig")

    elif extension == ".docx":
        doc = Document(io.BytesIO(data))

        paragraphs = [
            p.text for p in doc.paragraphs if p.text.strip()
        ]

        for table in doc.tables:
            for row in table.rows:
                paragraphs.append(
                    " | ".join(cell.text for cell in row.cells)
                )

        result["text"] = "\n".join(paragraphs)

    elif extension == ".pptx":
        presentation = Presentation(io.BytesIO(data))
        slides = []

        for index, slide in enumerate(presentation.slides, 1):
            lines = []

            for shape in slide.shapes:
                if shape.has_text_frame:
                    lines.append(shape.text)

                if shape.has_table:
                    for row in shape.table.rows:
                        lines.append(
                            " | ".join(
                                cell.text for cell in row.cells
                            )
                        )

            slides.append(
                f"Slide {index}\n" + "\n".join(lines)
            )

        result["text"] = "\n\n".join(slides)
        result["analysis"]["slide_count"] = len(slides)

    elif extension == ".pdf":
        reader = PdfReader(io.BytesIO(data))
        result["text"] = "\n\n".join(
            page.extract_text() or ""
            for page in reader.pages
        )
        result["analysis"]["page_count"] = len(reader.pages)

    return result
