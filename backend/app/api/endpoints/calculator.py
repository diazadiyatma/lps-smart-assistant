import logging
import io
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Header, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from fpdf import FPDF
from app.core.database import supabase_client


router = APIRouter()
logger = logging.getLogger("app")

def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ")[1]
    if supabase_client is None:
        raise HTTPException(status_code=500, detail="Supabase client not initialized")
    try:
        user_response = supabase_client.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token user payload")
        return user_response.user
    except Exception as e:
        logger.error(f"Auth error: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

def log_audit_to_supabase(token: str, user_id: str, nama_nasabah: str, nama_bank: str, total_simpanan: int, suku_bunga: float, status_jaminan: str):
    from supabase import create_client
    from app.core.config import settings
    try:
        # Create user-scoped client to satisfy Supabase RLS authenticated policy
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        client.postgrest.auth(token)
        client.table("audit_history").insert({
            "user_id": user_id,
            "nama_nasabah": nama_nasabah,
            "nama_bank": nama_bank,
            "total_simpanan": total_simpanan,
            "suku_bunga": suku_bunga,
            "status_jaminan": status_jaminan
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log audit to Supabase: {str(e)}")

def log_calculation_to_supabase(bank_name: str, balance: float, interest_rate: float, status: str):
    if supabase_client is None:
        logger.warning("Supabase client not initialized. Skipping database logging.")
        return
    try:
        supabase_client.table("calculation_histories").insert({
            "bank_name": bank_name,
            "balance": balance,
            "interest_rate": interest_rate,
            "status": status
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log calculation to Supabase: {str(e)}")

# Input model validation with Pydantic V2 syntax
class CalculationRequest(BaseModel):
    customer_name: str = Field(..., min_length=1, description="Name of the customer/depositor")
    bank_name: str = Field(..., min_length=1, description="Name of the financial institution")
    total_balance: float = Field(..., gt=0, description="Total balance in Indonesian Rupiah (IDR)")
    interest_rate: float = Field(..., ge=0, description="Annual bank interest rate as a percentage")
    is_recorded: bool = Field(..., description="T1: Deposit is officially recorded in the bank ledger")
    is_not_harmful: bool = Field(..., description="T3: Depositor has not caused harm to the bank (e.g., non-performing loans)")

# Output model structure
class CalculationResponse(BaseModel):
    status: str
    is_guaranteed: bool
    reason: Optional[str] = None

@router.post("/calculate", response_model=CalculationResponse)
def calculate_lps_eligibility(
    payload: CalculationRequest, 
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None)
) -> CalculationResponse:
    """
    Evaluate deposit eligibility for LPS protection based on standard 3T parameters:
    1. Tercatat (Recorded in ledger) - is_recorded
    2. Tingkat Bunga Layak (Interest rate cap) - Capped at 4.25%
    3. Tidak Merugikan Bank (Non-harmful behaviors) - is_not_harmful
    """
    reasons = []
    user_id = None
    token = None

    if authorization:
        try:
            token = authorization.split(" ")[1]
            user = get_current_user(authorization)
            user_id = user.id
        except Exception as e:
            logger.warning(f"Failed to authenticate user for logging: {str(e)}")
            # Optional: fail calculation or just ignore. The prompt implies it receives JWT from frontend when user scans/verifies. 
            # If JWT is expired/invalid, let's raise 410/401 to let them know.
            raise HTTPException(status_code=401, detail="Session expired. Please login again.")

    # Check 1: Interest Rate Cap (LPS Limit is 4.25%)
    if payload.interest_rate > 4.25:
        reasons.append(
            f"The bank interest rate of {payload.interest_rate}% exceeds the maximum allowable guaranteed rate of 4.25%."
        )

    # Check 2: Recorded in Bank Ledger (T1)
    if not payload.is_recorded:
        reasons.append(
            "The deposit is not officially recorded in the bank's general ledger (violates T1 - Tercatat)."
        )

    # Check 3: Free from harmful actions (T3)
    if not payload.is_not_harmful:
        reasons.append(
            "The customer is associated with outstanding non-performing loans or actions causing harm to the bank (violates T3 - Tidak Merugikan Bank)."
        )

    # If any checks failed, the deposit is not eligible
    if reasons:
        # Dynamically join the failure contexts
        reason_str = " ".join(reasons)
        status = "Not Eligible for Payout"
        background_tasks.add_task(
            log_calculation_to_supabase,
            payload.bank_name,
            payload.total_balance,
            payload.interest_rate,
            status
        )
        if user_id and token:
            background_tasks.add_task(
                log_audit_to_supabase,
                token,
                user_id,
                payload.customer_name,
                payload.bank_name,
                int(payload.total_balance),
                payload.interest_rate,
                status
            )
        return CalculationResponse(
            status=status,
            is_guaranteed=False,
            reason=reason_str
        )

    # If all safety requirements are satisfied
    status = "Fully Eligible for Payout"
    background_tasks.add_task(
        log_calculation_to_supabase,
        payload.bank_name,
        payload.total_balance,
        payload.interest_rate,
        status
    )
    if user_id and token:
        background_tasks.add_task(
            log_audit_to_supabase,
            token,
            user_id,
            payload.customer_name,
            payload.bank_name,
            int(payload.total_balance),
            payload.interest_rate,
            status
        )
    return CalculationResponse(
        status=status,
        is_guaranteed=True
    )

@router.get("/audit-history")
def get_audit_history(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ")[1]
    user = get_current_user(authorization)
    
    from supabase import create_client
    from app.core.config import settings
    try:
        # Create user-scoped client to satisfy Supabase RLS authenticated policy
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        client.postgrest.auth(token)
        response = client.table("audit_history")\
            .select("*")\
            .eq("user_id", user.id)\
            .order("created_at", desc=True)\
            .execute()
        return response.data
    except Exception as e:
        logger.error(f"Failed to fetch audit history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit history: {str(e)}")

class CertificateRequest(BaseModel):
    customer_name: str = Field(..., description="Name of the customer/depositor")
    bank_name: str = Field(..., description="Name of the financial institution")
    total_balance: float = Field(..., description="Total balance in Indonesian Rupiah")
    interest_rate: float = Field(..., description="Annual bank interest rate as a percentage")
    is_guaranteed: bool = Field(..., description="LPS guarantee eligibility status")

class LPSCertificate(FPDF):
    def header(self):
        # Draw elegant borders around the page
        self.set_line_width(1)
        self.set_draw_color(226, 135, 22) # Orange #E28716
        self.rect(5, 5, 200, 287) # 5mm margins
        
        self.set_line_width(0.3)
        self.rect(7, 7, 196, 283)
        
    def footer(self):
        # Position at 1.5 cm from bottom
        self.set_y(-15)
        self.set_font("helvetica", "I", 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, "Simulasi ini diterbitkan secara otomatis oleh LPS Smart-Assistant. Halaman 1/1", align="C")

def format_rupiah(value: float) -> str:
    parts = f"{value:,.0f}".split(".")
    return "Rp " + parts[0].replace(",", ".")

@router.post("/download-certificate")
def download_certificate(payload: CertificateRequest):
    try:
        # Get current time in GMT+7
        gmt7 = timezone(timedelta(hours=7))
        audit_time = datetime.now(gmt7).strftime("%d-%m-%Y %H:%M:%S WIB")

        pdf = LPSCertificate()
        pdf.add_page()

        # Title banner
        pdf.set_y(20)
        # Top logo simulation text or emblem
        pdf.set_font("helvetica", "B", 16)
        pdf.set_text_color(226, 135, 22) # E28716 Orange
        pdf.cell(0, 10, "LEMBAGA PENJAMIN SIMPANAN", ln=True, align="C")
        pdf.set_font("helvetica", "", 10)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 5, "REPUBLIK INDONESIA", ln=True, align="C")

        # Horizontal divider
        pdf.ln(5)
        pdf.set_draw_color(200, 200, 200)
        pdf.line(20, 42, 190, 42)

        pdf.ln(10)
        pdf.set_font("helvetica", "B", 18)
        pdf.set_text_color(30, 41, 59) # Slate color
        pdf.cell(0, 10, "SERTIFIKAT SIMULASI PENJAMINAN", ln=True, align="C")

        pdf.ln(5)
        pdf.set_font("helvetica", "", 11)
        pdf.set_text_color(71, 85, 105)
        pdf.multi_cell(170, 6, "Berdasarkan hasil simulasi sistem audit kepatuhan 3T (Tercatat, Tepat Bunga, dan Tidak Merugikan Bank) yang dilakukan secara mandiri melalui LPS Smart-Assistant, maka data simpanan nasabah di bawah ini:", align="C")

        # Table / details
        pdf.ln(8)
        pdf.set_fill_color(248, 250, 252) # Light gray
        pdf.set_draw_color(226, 232, 240)
        pdf.rect(30, 85, 150, 65, style="FD") # draw background rectangle

        # Table content
        pdf.set_xy(35, 90)
        pdf.set_font("helvetica", "B", 10)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(50, 8, "Nama Nasabah:")
        pdf.set_font("helvetica", "", 11)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(90, 8, payload.customer_name, ln=True)

        pdf.set_x(35)
        pdf.set_font("helvetica", "B", 10)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(50, 8, "Nama Bank:")
        pdf.set_font("helvetica", "", 11)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(90, 8, payload.bank_name, ln=True)

        pdf.set_x(35)
        pdf.set_font("helvetica", "B", 10)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(50, 8, "Total Saldo Simpanan:")
        pdf.set_font("helvetica", "B", 11)
        pdf.set_text_color(226, 135, 22) # primary color
        pdf.cell(90, 8, format_rupiah(payload.total_balance), ln=True)

        pdf.set_x(35)
        pdf.set_font("helvetica", "B", 10)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(50, 8, "Suku Bunga Bank:")
        pdf.set_font("helvetica", "", 11)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(90, 8, f"{payload.interest_rate}% p.a. (Maks. Dijamin: 4.25%)", ln=True)

        pdf.set_x(35)
        pdf.set_font("helvetica", "B", 10)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(50, 8, "Waktu Audit:")
        pdf.set_font("helvetica", "", 11)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(90, 8, audit_time, ln=True)

        # Guarantee status banner
        pdf.set_y(160)
        if payload.is_guaranteed:
            pdf.set_fill_color(16, 185, 129) # success color
            pdf.set_draw_color(16, 185, 129)
            pdf.set_text_color(255, 255, 255)
            status_text = "STATUS KELAYAKAN: DIJAMIN SEPENUHNYA OLEH LPS"
        else:
            pdf.set_fill_color(239, 68, 68) # error color
            pdf.set_draw_color(239, 68, 68)
            pdf.set_text_color(255, 255, 255)
            status_text = "STATUS KELAYAKAN: TIDAK DIJAMIN OLEH LPS"

        pdf.rect(30, 160, 150, 15, style="FD")
        pdf.set_xy(30, 163)
        pdf.set_font("helvetica", "B", 11)
        pdf.cell(150, 10, status_text, align="C", ln=True)

        # Legal disclaimer
        pdf.set_y(185)
        pdf.set_font("helvetica", "I", 9)
        pdf.set_text_color(100, 116, 139)
        if payload.is_guaranteed:
            pdf.multi_cell(170, 5, "Simulasi menunjukkan bahwa simpanan ini memenuhi seluruh ketentuan 3T Lembaga Penjamin Simpanan (Tercatat pada pembukuan bank, tingkat bunga wajar di bawah atau sama dengan tingkat bunga penjaminan, dan tidak merugikan bank seperti kredit macet). Oleh karena itu, simpanan dijamin sesuai ketentuan perundang-undangan.", align="C")
        else:
            pdf.multi_cell(170, 5, "Simulasi menunjukkan bahwa simpanan ini tidak memenuhi salah satu atau lebih ketentuan 3T Lembaga Penjamin Simpanan (Tercatat, Tepat Bunga, Tidak Merugikan Bank). Simpanan yang tidak memenuhi kriteria tersebut tidak dapat dibayarkan penjaminannya jika bank dicabut izin usahanya.", align="C")

        # Signature
        pdf.set_y(220)
        pdf.set_x(120)
        pdf.set_font("helvetica", "", 10)
        pdf.set_text_color(71, 85, 105)
        pdf.cell(70, 5, "Diterbitkan oleh:", ln=True, align="C")
        pdf.set_x(120)
        pdf.set_font("helvetica", "B", 10)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(70, 5, "Sistem Verifikasi LPS Smart-Assistant", ln=True, align="C")

        # Circular seal watermark
        pdf.set_draw_color(226, 135, 22)
        pdf.set_line_width(0.5)
        pdf.ellipse(140, 235, 30, 30)
        pdf.ellipse(141.5, 236.5, 27, 27)
        pdf.set_font("helvetica", "B", 7)
        pdf.set_text_color(226, 135, 22)
        pdf.set_xy(140, 244)
        pdf.cell(30, 4, "SIMULASI", align="C", ln=True)
        pdf.set_x(140)
        pdf.cell(30, 4, "LPS SMART", align="C", ln=True)
        pdf.set_x(140)
        pdf.cell(30, 4, "ASSISTANT", align="C", ln=True)

        # Output bytes directly in memory
        pdf_bytes = pdf.output()
        
        # In FPDF2, output() without file returns bytes
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=Sertifikat_LPS_Simulasi.pdf"
            }
        )
    except Exception as e:
        logger.error(f"Error generating PDF certificate: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Gagal men-generate file PDF sertifikat.")

