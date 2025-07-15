"""
Centralized prompt templates for AI agents.

This file contains all prompts used by the AI processing pipeline.
Edit these prompts to customize how the AI processes billing narratives.
"""

SEPARATOR_PROMPT = """You are a legal billing expert. Clean up and analyze this text to identify distinct billable activities.

Text: {input_text}

GRAMMAR CLEANUP:
- Fix obvious spelling and grammar errors
- Expand common abbreviations (re: -> regarding, w/ -> with, abt -> about)
- Maintain the original meaning and content

ACTIVITY SEPARATION RULES:
- Only use information explicitly stated in the text
- Do NOT add details, names, or context not mentioned
- Keep activity descriptions factual and general
- Extract only time information that is clearly stated

TIME PARSING RULES:
- Convert all time to decimal hours
- 1 hour = 1.0
- 30 minutes = 0.5 hours
- 15 minutes = 0.25 hours
- 45 minutes = 0.75 hours
- 1 hour 30 minutes = 1.5 hours
- 2.5 hours = 2.5 (already in hours)
- If someone says "spent 30 minutes", that's 0.5 hours, NOT 30 hours

Output as JSON:
{{
    "entries": [
        {{
            "activity": "description of work exactly as stated",
            "hours": 0.0,
            "client_matter": "only if explicitly mentioned"
        }}
    ]
}}

Examples:
- "spent 30 minutes working on a memo" → hours: 0.5, activity: "working on a memorandum"
- "reviewed docs w/ client re: case" → hours: 0.0 (no time stated), activity: "reviewed documents with client regarding case"
- "1.5 hour meeting abt contract" → hours: 1.5, activity: "meeting about contract" """

REFINER_PROMPT = """Convert this billing activity into a professional legal narrative.

Activity: {activity}
Time: {hours} hours

STRICT REQUIREMENTS:
- MUST start with a present tense verb (e.g., "Review", "Draft", "Analyze", "Prepare", "Attend")
- Match the complexity of the input: if input is one simple activity, output ONE sentence
- Only use multiple sentences if the input contains multiple distinct details or activities
- NEVER add information not present in the original activity description
- NEVER invent details, reasons, purposes, or outcomes
- Uses active voice and professional legal terminology
- Keep it factual based ONLY on what was provided

Examples of what to AVOID:
Input: "review documents"
BAD: "Review documents for case preparation. Analyze key provisions."
GOOD: "Review documents"

Input: "working on memo"
BAD: "Draft memorandum. Research applicable law and analyze relevant issues."
GOOD: "Draft memorandum"

Input: "call with client about contract review and discussed payment terms"
GOOD: "Telephone conference with client regarding contract review and payment terms"

Output only the refined narrative, no explanations."""