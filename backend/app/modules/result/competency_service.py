import json
import httpx
from uuid import UUID
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.config import get_settings
from app.modules.result.models import UserResult, CompetencyAnalysis
from app.modules.questions.models import Question
from app.modules.users.models import User

settings = get_settings()

def get_skill_from_mondai(mondai_group: str) -> str:
    """Map a Mondai group to a general skill label."""
    if not mondai_group:
        return "Khác"
    mondai = mondai_group.lower().strip()
    
    # Generic mapping logic based on typical JLPT patterns.
    # Adjust this based on your actual data.
    if "từ vựng" in mondai or "kanji" in mondai:
        return "Từ vựng"
    elif "ngữ pháp" in mondai:
        return "Ngữ pháp"
    elif "đọc" in mondai or "đoạn văn" in mondai:
        return "Đọc hiểu"
    elif "nghe" in mondai or "choukai" in mondai:
        return "Nghe hiểu"
    
    # Simple fallback based on Mondai numbering if actual text isn't clear
    if "mondai 1" in mondai or "mondai 2" in mondai or "mondai 3" in mondai:
         return "Từ vựng / Ký tự"
    elif "mondai 4" in mondai or "mondai 5" in mondai or "mondai 6" in mondai:
         return "Ngữ pháp / Đọc"
    return "Khác"


def extract_json_from_llm_response(text: str) -> dict:
    """Safely extract JSON from an LLM response even if it's wrapped in markdown backticks."""
    text = text.strip()
    if text.startswith("```"):
        # Remove up to the first newline after ``` or ```json
        lines = text.split("\n")
        if len(lines) > 1:
             text = "\n".join(lines[1:])
        if text.endswith("```"):
             text = text[:-3]
    
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        # Fallback to empty if it completely fails
        return {
             "overview": "Không thể phân tích kết quả lúc này.",
             "strengths": [],
             "weaknesses_analysis": text, 
             "actionable_advice": []
        }

class CompetencyAnalysisService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_analysis(self, result_id: UUID, current_user: User) -> CompetencyAnalysis:
        # 1. Check if analysis already exists
        query = select(CompetencyAnalysis).where(CompetencyAnalysis.result_id == result_id)
        existing = await self.db.execute(query)
        analysis = existing.scalar_one_or_none()
        
        if analysis:
            return analysis
            
        # 2. Fetch UserResult and authorize
        result_query = select(UserResult).where(UserResult.result_id == result_id)
        user_res_exec = await self.db.execute(result_query)
        user_result = user_res_exec.scalar_one_or_none()
        
        if not user_result:
            raise HTTPException(status_code=404, detail="Result not found")
            
        if user_result.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this result")
            
        # 3. Fetch questions mapping to exam
        q_query = select(Question).where(Question.exam_id == user_result.exam_id).options(joinedload(Question.answers))
        q_exec = await self.db.execute(q_query)
        # Ensure we unique() the result because of joinedload
        questions = q_exec.unique().scalars().all()
        q_dict = {str(q.question_id): q for q in questions}
        
        # 4. Analyze mistakes and skills
        skill_stats: Dict[str, Dict[str, int]] = {} # e.g. {"Từ vựng": {"total": 5, "correct": 3}}
        mistakes_info = []
        user_answers = user_result.user_answers or {}
        
        # Determine format of user_answers
        # It could be {"q_id": "ans_id"} or a list [{"question_id": "...", "answer_id": "..."}]
        if isinstance(user_answers, list):
            # Convert to dict mapping for easier usage
            user_answers = {str(ans.get("question_id")): str(ans.get("answer_id")) for ans in user_answers if ans.get("question_id")}
            
        for q_id_str, ans_id_val in user_answers.items():
            q = q_dict.get(q_id_str)
            if not q:
                continue
                
            skill = get_skill_from_mondai(q.mondai_group)
            if skill not in skill_stats:
                skill_stats[skill] = {"total": 0, "correct": 0}
                
            skill_stats[skill]["total"] += 1
            
            # Check if answer is correct
            is_correct = False
            user_selected_text = "Không có"
            for a in q.answers:
                if str(a.answer_id) == str(ans_id_val):
                    user_selected_text = a.content or "Hình ảnh"
                    if a.is_correct:
                        is_correct = True
                    break
                    
            if is_correct:
                 skill_stats[skill]["correct"] += 1
            else:
                 # Collect mistake context
                 mistakes_info.append({
                     "skill": skill,
                     "question": q.question_text or "Câu hỏi không có nội dung text",
                     "user_selected": user_selected_text,
                     "is_correct": False,
                     "explanation": q.explanation or "Không có giải thích chi tiết."
                 })
                 
        # Format strings for the prompt
        skill_summary = []
        skill_percentages = {}
        for skill, stats in skill_stats.items():
            percentage = (stats['correct'] / stats['total']) * 100 if stats['total'] > 0 else 0
            skill_summary.append(f"- {skill}: {percentage:.1f}% (đúng {stats['correct']}/{stats['total']})")
            skill_percentages[skill] = round(percentage, 1)
            
        # Truncate mistakes if too many to avoid massive prompt context
        mistakes_to_send = mistakes_info[:15]
        
        # 5. Build Prompt
        system_prompt = (
            "Bạn là một chuyên gia đánh giá năng lực tiếng Nhật JLPT có tâm huyết và cực kỳ nghiêm khắc nhưng thấu hiểu. "
            "Nhận xét của bạn luôn thẳng thắn, súc tích, đi thẳng vào vấn đề cốt lõi, không vòng vo hay sáo rỗng."
        )
        
        user_prompt = f"""DỮ LIỆU ĐẦU VÀO:
- Tỷ lệ đúng từng kỹ năng:
{chr(10).join(skill_summary)}

- Chi tiết lỗi sai tiêu biểu:
{json.dumps(mistakes_to_send, ensure_ascii=False, indent=2)}

YÊU CẦU PHÂN TÍCH (Ngắn gọn, súc tích tối đa):
1. Khái quát nhánh năng lực chênh lệch. Tổng hợp và tìm ra đâu là kỹ năng mạnh nhất, kỹ năng yếu nhất.
2. Quan sát "Chi tiết các câu làm sai", đọc kỹ "explanation", tìm ra quy luật chọn sai của học viên.
3. Đưa ra lời khuyên thực tế, chỉ định hành động khắc phục cụ thể.

ĐỊNH DẠNG JSON ĐẦU RA BẮT BUỘC (Không thêm text ngoài JSON):
{{
  "overview": "Đánh giá chung (Tối đa 2 câu chẩn đoán cốt lõi).",
  "strengths": ["Điểm mạnh 1 (ngắn gọn)", "Điểm mạnh 2 (ngắn gọn)"],
  "weaknesses_analysis": "Phân tích thẳng vào lỗ hổng kiến thức chính (Tối đa 2 câu).",
  "actionable_advice": ["Giải pháp 1 (Cụ thể, thực tế)", "Giải pháp 2 (Cụ thể, thực tế)"]
}}
"""
        
        # 6. Call Local LLM
        payload = {
            "model": settings.LM_STUDIO_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.5, # Slightly deterministic to keep JSON structure
        }
        
        try:
            async with httpx.AsyncClient(timeout=3000.0) as client:
                res = await client.post(settings.LM_STUDIO_API_URL, json=payload)
                res.raise_for_status()
                data = res.json()
                content = data["choices"][0]["message"]["content"]
                
                parsed = extract_json_from_llm_response(content)
                
            # Only save to DB if it was successful
            new_analysis = CompetencyAnalysis(
                result_id=result_id,
                overview=parsed.get("overview", ""),
                strengths=parsed.get("strengths", []),
                weaknesses_analysis=parsed.get("weaknesses_analysis", ""),
                actionable_advice=parsed.get("actionable_advice", []),
                skill_metrics=skill_percentages
            )
            
            from sqlalchemy.exc import IntegrityError
            try:
                self.db.add(new_analysis)
                await self.db.commit()
                await self.db.refresh(new_analysis)
                return new_analysis
            except IntegrityError:
                await self.db.rollback()
                # If constraint violated, another concurrent request already saved it.
                query = select(CompetencyAnalysis).where(CompetencyAnalysis.result_id == result_id)
                existing = await self.db.execute(query)
                return existing.scalar_one_or_none()
                
        except Exception as e:
            print(f"LLM Error: {str(e)}")
            # If LLM network fails, return an ephemeral fallback without saving to DB.
            import uuid
            from datetime import datetime, timezone
            return CompetencyAnalysis(
                analysis_id=uuid.uuid4(),
                result_id=result_id,
                overview="Hệ thống AI hiện đang bận hoặc bị gián đoạn kết nối. Vui lòng thử bấm lại hoặc kiểm tra LM Studio ở cổng 1234.",
                strengths=[],
                weaknesses_analysis="Không thể phân tích do lỗi kết nối nội bộ hoặc thời gian chờ (timeout) quá lâu.",
                actionable_advice=[],
                created_at=datetime.now(timezone.utc)
            )
