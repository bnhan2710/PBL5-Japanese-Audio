import json
import httpx
import re
from uuid import UUID
from typing import Dict, Any, List, Optional, Union
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.config import get_settings
from app.modules.result.models import UserResult, CompetencyAnalysis
from app.modules.questions.models import Question
from app.modules.users.models import User

settings = get_settings()

JLPT_STANDARD_MAPPING = {
    "N1": {
        1: "Hiểu vấn đề",
        2: "Hiểu điểm chính",
        3: "Hiểu khái quát",
        4: "Phản xạ nhanh",
        5: "Hiểu tổng hợp",
    },
    "N2": {
        1: "Hiểu vấn đề",
        2: "Hiểu điểm chính",
        3: "Hiểu khái quát",
        4: "Phản xạ nhanh",
        5: "Hiểu tổng hợp",
    },
    "N3": {
        1: "Hiểu vấn đề",
        2: "Hiểu điểm chính",
        3: "Hiểu khái quát",
        4: "Biểu hiện phát ngôn",
        5: "Phản xạ nhanh",
    },
    "N4": {1: "Hiểu vấn đề", 2: "Hiểu điểm chính", 3: "Biểu hiện phát ngôn", 4: "Phản xạ nhanh"},
    "N5": {1: "Hiểu vấn đề", 2: "Hiểu điểm chính", 3: "Biểu hiện phát ngôn", 4: "Phản xạ nhanh"},
}


def get_skill_from_mondai(
    mondai_group: str, level: Optional[str] = None
) -> tuple[str, Optional[int]]:
    """Map a Mondai group to a general skill label and its ID."""
    if not mondai_group:
        return "Khác", None

    mondai_label = mondai_group.lower().strip()

    # Extract mondai number (e.g. "Mondai 1" -> 1)
    match = re.search(r"\d+", mondai_label)
    m_id = int(match.group()) if match else None

    # Normalize level
    level = (level or "").upper().strip()

    # 1. Check keywords first
    if "tổng hợp" in mondai_label or "sougou" in mondai_label or "tougou" in mondai_label:
        return "Hiểu tổng hợp", 5
    elif "phát ngôn" in mondai_label or "biểu hiện" in mondai_label or "hatsuwa" in mondai_label:
        return "Biểu hiện phát ngôn", (4 if level == "N3" else 3)
    elif "phản xạ" in mondai_label or "sokuji" in mondai_label or "tức thời" in mondai_label:
        return "Phản xạ nhanh", (
            5 if level == "N3" else (4 if level in ["N2", "N1", "N4", "N5"] else 4)
        )
    elif "khái quát" in mondai_label or "tổng quan" in mondai_label or "gaiyou" in mondai_label:
        return "Hiểu khái quát", 3
    elif "điểm chính" in mondai_label or "point" in mondai_label:
        return "Hiểu điểm chính", 2
    elif "vấn đề" in mondai_label or "kadai" in mondai_label:
        return "Hiểu vấn đề", 1

    # 2. Map by Mondai ID and Level
    if m_id is not None and level in JLPT_STANDARD_MAPPING:
        skill = JLPT_STANDARD_MAPPING[level].get(m_id)
        if skill:
            return skill, m_id

    # Fallback
    if m_id:
        return f"Mondai {m_id}", m_id
    return "Kỹ năng khác", None


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
            "actionable_advice": [],
        }


class CompetencyAnalysisService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_analysis(
        self, result_id: UUID, current_user: User
    ) -> CompetencyAnalysis:
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
        q_query = (
            select(Question)
            .where(Question.exam_id == user_result.exam_id)
            .options(joinedload(Question.answers), joinedload(Question.exam))
        )
        q_exec = await self.db.execute(q_query)
        # Ensure we unique() the result because of joinedload
        questions = q_exec.unique().scalars().all()
        q_dict = {str(q.question_id): q for q in questions}

        # Get Exam level if possible
        exam_obj = None
        if questions:
            exam_obj = questions[0].exam

        jlpt_level = None
        if exam_obj:
            title = (exam_obj.title or "").upper()
            desc = (exam_obj.description or "").upper()
            match = re.search(r"(N[1-5])", title + desc)
            if match:
                jlpt_level = match.group(1)

        # Default to N2 if not found
        effective_level = jlpt_level or "N2"

        # 4. Analyze mistakes and skills
        # Initialize with standard skills for the level
        skill_stats: Dict[str, Dict[str, Any]] = {}
        standard_for_level = JLPT_STANDARD_MAPPING.get(effective_level, JLPT_STANDARD_MAPPING["N2"])
        for m_id, skill_name in standard_for_level.items():
            skill_stats[skill_name] = {"total": 0, "correct": 0, "mondai_id": m_id}

        mistakes_info = []
        user_answers = user_result.user_answers or {}

        # 4a. First calculate TOTAL questions per skill from all exam questions
        for q in questions:
            skill, m_id = get_skill_from_mondai(q.mondai_group, level=effective_level)
            if skill not in skill_stats:
                skill_stats[skill] = {"total": 0, "correct": 0, "mondai_id": m_id}
            skill_stats[skill]["total"] += 1

        # 4b. Then calculate CORRECT answers from user_answers
        # Determine format of user_answers
        # It could be {"q_id": "ans_id"} or a list [{"question_id": "...", "answer_id": "..."}]
        if isinstance(user_answers, list):
            # Convert to dict mapping for easier usage
            user_answers = {
                str(ans.get("question_id")): str(ans.get("answer_id"))
                for ans in user_answers
                if ans.get("question_id")
            }

        for q_id_str, ans_id_val in user_answers.items():
            q = q_dict.get(q_id_str)
            if not q:
                continue

            skill, m_id = get_skill_from_mondai(q.mondai_group, level=effective_level)
            if skill not in skill_stats:
                # This case shouldn't happen if q is in q_dict, but for safety:
                skill_stats[skill] = {"total": 0, "correct": 0, "mondai_id": m_id}

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
                mistakes_info.append(
                    {
                        "skill": skill,
                        "question": q.question_text or "Câu hỏi không có nội dung text",
                        "user_selected": user_selected_text,
                        "is_correct": False,
                        "explanation": q.explanation or "Không có giải thích chi tiết.",
                    }
                )

        # Format strings for the prompt
        skill_summary = []
        skill_metrics_rich = {}
        for skill, stats in skill_stats.items():
            percentage = (stats["correct"] / stats["total"]) * 100 if stats["total"] > 0 else 0
            skill_summary.append(
                f"- {skill}: {percentage:.1f}% (đúng {stats['correct']}/{stats['total']})"
            )
            skill_metrics_rich[skill] = {
                "correct": stats["correct"],
                "total": stats["total"],
                "percentage": round(percentage, 1),
                "mondai_id": stats.get("mondai_id"),
            }

        # Round-robin: Phân bổ rải đều các lỗi sai theo từng nhóm kỹ năng để AI có cái nhìn toàn diện
        mistakes_to_send = []
        if len(mistakes_info) > 15:
            skill_groups = {}
            for m in mistakes_info:
                skill_groups.setdefault(m["skill"], []).append(m)

            while len(mistakes_to_send) < 15 and skill_groups:
                for skill in list(skill_groups.keys()):
                    if skill_groups[skill]:
                        mistakes_to_send.append(skill_groups[skill].pop(0))
                    else:
                        del skill_groups[skill]
                    if len(mistakes_to_send) == 15:
                        break
        else:
            mistakes_to_send = mistakes_info

        # 5. Build Prompt
        system_prompt = (
            "You are a dedicated, highly strict yet understanding JLPT Japanese language competency assessment expert. "
            "Your feedback is always straightforward, concise, gets right to the core issue, and avoids empty or roundabout phrases. "
            "When analyzing, pay close attention to typical JLPT listening traps such as: last-minute decision changes, "
            "the use of honorifics/humble language (keigo/kenjougo), or contrastive conjunctions (shikashi, demo, tokoroga). "
            "IMPORTANT: Your entire response must be written exclusively in Vietnamese."
        )

        user_prompt = f"""INPUT DATA:
- Accuracy rate by skill:
{chr(10).join(skill_summary)}

- Typical mistakes details:
{json.dumps(mistakes_to_send, ensure_ascii=False, indent=2)}

ANALYSIS REQUIREMENTS (Extremely concise and brief):
1. Generalize the competency gap. Synthesize and determine the strongest and weakest skills.
2. Observe the "Typical mistakes details", read the "explanation" carefully, and identify the patterns in the student's incorrect choices.
3. Provide practical advice and specify concrete corrective actions.
4. YOUR OUTPUT TEXT MUST BE IN VIETNAMESE.

MANDATORY OUTPUT JSON FORMAT (Do not add any markdown formatting or text outside the JSON):
{{
  "overview": "Đánh giá chung (Tối đa 2 câu chẩn đoán cốt lõi bằng tiếng Việt).",
  "strengths": ["Điểm mạnh 1 bằng tiếng Việt (ngắn gọn)", "Điểm mạnh 2 bằng tiếng Việt (ngắn gọn)"],
  "weaknesses_analysis": "Phân tích thẳng vào lỗ hổng kiến thức chính bằng tiếng Việt (Tối đa 2 câu).",
  "actionable_advice": ["Giải pháp 1 bằng tiếng Việt (Cụ thể, thực tế)", "Giải pháp 2 bằng tiếng Việt (Cụ thể, thực tế)"]
}}
"""

        # 6. Call Local LLM
        payload = {
            "model": settings.LM_STUDIO_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.5,  # Slightly deterministic to keep JSON structure
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
                skill_metrics=skill_metrics_rich,
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
                created_at=datetime.now(timezone.utc),
            )
