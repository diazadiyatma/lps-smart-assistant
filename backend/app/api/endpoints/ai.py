import os
import re
import httpx
from typing import Optional
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field

# Load environment variables
load_dotenv(override=True)

router = APIRouter()

# Schema for Chat Request/Response
class ChatRequest(BaseModel):
    message: str = Field(..., description="The user's message to the LPS Smart-Assistant.")

class ChatResponse(BaseModel):
    reply: str

# Schema for Document Scan Response
class DocumentScanResponse(BaseModel):
    raw_text: str
    extracted_balance: Optional[float] = None
    extracted_interest_rate: Optional[float] = None
    extracted_customer_name: Optional[str] = None

@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(payload: ChatRequest):
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured on the server.")

    system_instruction_text = (
        "You are the 'LPS Smart-Assistant', the official automated AI representative of the "
        "Indonesian Deposit Insurance Corporation (LPS). Your strict mandate is to educate "
        "ordinary citizens who are anxious or curious about the safety of their money in the "
        "banking system. You must communicate using polite, reassuring, clear, and highly "
        "accessible Indonesian, completely avoiding complex macroeconomic or legal jargon. "
        "CRITICAL: Keep your response very concise, direct, and short (maximum 2 to 3 sentences / 50 words). "
        "Do NOT write long paragraphs, bullet points, or list guides unless specifically asked. "
        "You must strictly state that the maximum deposit balance guaranteed by LPS is Rp2.000.000.000 "
        "(2 Miliar Rupiah) per nasabah per bank, and the maximum guaranteed interest rate is 4.25% for Rupiah deposits. "
        "Always briefly remind the user to cross-check their figures using the 3T Calculator on the dashboard."
    )

    url = "https://openrouter.ai/api/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {gemini_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/lps-smart-assistant",
        "X-Title": "LPS Smart Assistant"
    }

    request_body = {
        "model": "openai/gpt-oss-20b:free",
        "messages": [
            {
                "role": "system",
                "content": system_instruction_text
            },
            {
                "role": "user",
                "content": payload.message
            }
        ]
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=request_body, timeout=30.0)
            response.raise_for_status()
            data = response.json()
            
            # Extract response text safely
            try:
                reply_text = data["choices"][0]["message"]["content"]
            except (KeyError, IndexError):
                reply_text = "Mohon maaf, saya sedang mengalami kendala teknis dalam merespons pesan Anda."
            
            return ChatResponse(reply=reply_text)
            
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"OpenRouter API error: {e.response.text}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Failed to communicate with OpenRouter API: {str(e)}")


@router.post("/scan-document", response_model=DocumentScanResponse)
async def scan_document(file: UploadFile = File(...)):
    ocr_space_key = os.getenv("OCR_SPACE_KEY")
    if not ocr_space_key:
        raise HTTPException(status_code=500, detail="OCR_SPACE_KEY is not configured on the server.")

    # Read the uploaded file into memory
    file_bytes = await file.read()
    
    url = "https://api.ocr.space/parse/image"
    
    # We send multipart form data as required by OCR.space
    # Format: files={"file": (filename, file_object, content_type)}
    # Add apikey to data
    data = {
        "apikey": ocr_space_key,
        "language": "eng", # Defaulting to eng, can be adjusted
        "isOverlayRequired": "false"
    }
    files = {
        "file": (file.filename, file_bytes, file.content_type or "image/jpeg")
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, data=data, files=files, timeout=60.0)
            response.raise_for_status()
            result = response.json()
            
            if result.get("IsErroredOnProcessing"):
                err_msg = result.get("ErrorMessage", ["Unknown OCR error"])[0]
                raise HTTPException(status_code=400, detail=f"OCR Processing failed: {err_msg}")
            
            # Extract raw text from parsed results
            parsed_results = result.get("ParsedResults", [])
            if not parsed_results:
                raw_text = ""
            else:
                raw_text = "\n".join([res.get("ParsedText", "") for res in parsed_results])
            
            print("=== DEBUG OCR ===")
            print("RAW TEXT:", repr(raw_text))
            
            # Advanced Regex extraction for Indonesian financial formats
            extracted_balance = None
            extracted_interest_rate = None
            extracted_customer_name = None
            
            # 1. Extract Balance: Look for numbers with thousands separators, optionally preceded by Rp/IDR/Balance
            # Allowing O/o instead of 0 due to common OCR issues (e.g. 5O.OOO.OOO)
            balance_pattern = r"(?:Rp\.?\s*|IDR\s*|Balance\s*:?\s*)?([0-9Oo]{1,3}(?:\s*[.,]\s*[0-9Oo]{3})+(?:\s*[.,]\s*[0-9Oo]{1,2})?)"
            matches = list(re.finditer(balance_pattern, raw_text, re.IGNORECASE))
            
            print("FOUND BALANCE MATCHES:", [m.group(0) for m in matches])
            
            parsed_balances = []
            for match in matches:
                # Clean up and normalize O/o to 0
                val_str = match.group(1).replace(" ", "").replace("O", "0").replace("o", "0")
                
                # Remove any dot (.) or comma (,) if it precedes three zeros/digits (thousands separator)
                val_str = re.sub(r"[.,](?=000|\d{3})", "", val_str)
                
                # In IDR, '.' is often thousand separator and ',' is decimal. 
                # Heuristic: if the last separator is ',' and has 2 digits after it, replace '.' with '' and ',' with '.'
                if re.search(r",[0-9]{1,2}$", val_str):
                    val_str = val_str.replace('.', '').replace(',', '.')
                else:
                    val_str = val_str.replace(',', '').replace('.', '')
                
                try:
                    parsed_balances.append(float(val_str))
                except ValueError:
                    pass
            
            if parsed_balances:
                extracted_balance = max(parsed_balances)
                print("SELECTED EXTRACTED BALANCE:", extracted_balance)

            # 2. Extract Interest Rate: Look for percentages
            # Example matches: 4.25% | Bunga 3,5 % | 5%
            rate_pattern = r"([0-9]+[.,]?[0-9]*)\s*%"
            rate_match = re.search(rate_pattern, raw_text)
            
            if rate_match:
                clean_rate_str = rate_match.group(1).replace(',', '.')
                try:
                    extracted_interest_rate = float(clean_rate_str)
                except ValueError:
                    pass

            # 3. Extract Customer Name
            lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
            
            # Heuristic 1: In-line detection (e.g. "NAMA NASABAH : DIAZ AZA")
            for line in lines:
                if re.search(r'\bnama\b', line, re.IGNORECASE) and not re.search(r'\bbank\b', line, re.IGNORECASE):
                    match = re.search(r'(?:nama(?:\s*nasabah|\s*pemilik|\s*rekening)?|name)\s*[:;]\s*([A-Za-z\s.,]+)', line, re.IGNORECASE)
                    if match:
                        val = match.group(1).strip()
                        if val and not re.search(r'\b(?:no\.?\s*rek|cabang|alamat|bank)\b', val, re.IGNORECASE):
                            val_clean = re.sub(r'\s+', ' ', val)
                            if len(val_clean) >= 2 and len(val_clean) <= 50:
                                extracted_customer_name = val_clean
                                break

            if not extracted_customer_name:
                # Heuristic 2: Column-wise / tabular split (e.g. NAMA NASABAH \n NO. REKENING \n : DIAZ AZA)
                labels = []
                values = []
                for line in lines:
                    if line.startswith(':'):
                        val_text = line.lstrip(' :;').strip()
                        if val_text:
                            values.append(val_text)
                    elif re.search(r'^\s*(?:nama(?:\s*nasabah|\s*pemilik|\s*rekening)?|name)\s*$', line, re.IGNORECASE):
                        labels.append('name')
                    elif re.search(r'^\s*(?:no\.?\s*rekening|no\.?\s*rek|nomor\s*rekening)\s*$', line, re.IGNORECASE):
                        labels.append('rekening')
                    elif re.search(r'^\s*(?:cabang)\s*$', line, re.IGNORECASE):
                        labels.append('cabang')

                if 'name' in labels and len(values) >= len(labels):
                    try:
                        name_idx = labels.index('name')
                        if name_idx < len(values):
                            candidate = values[name_idx]
                            candidate_clean = re.sub(r'[^A-Za-z\s.,]', '', candidate).strip()
                            candidate_clean = re.sub(r'\s+', ' ', candidate_clean)
                            if len(candidate_clean) >= 2 and len(candidate_clean) <= 50:
                                extracted_customer_name = candidate_clean
                    except Exception:
                        pass

            if not extracted_customer_name:
                # Heuristic 3: Fallback to name-like lines
                for line in lines:
                    if re.search(r'nama|rekening|cabang|saldo|bunga|tanggal|debet|kredit|bank|lps', line, re.IGNORECASE):
                        continue
                    if re.search(r'\d', line):
                        continue
                    if re.match(r'^[A-Z\s.,]{3,30}$', line):
                        extracted_customer_name = line.strip()
                        break
            
            return DocumentScanResponse(
                raw_text=raw_text,
                extracted_balance=extracted_balance,
                extracted_interest_rate=extracted_interest_rate,
                extracted_customer_name=extracted_customer_name
            )

        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"OCR API error: {e.response.text}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Failed to communicate with OCR API: {str(e)}")
