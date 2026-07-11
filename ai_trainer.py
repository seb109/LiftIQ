from groq import AsyncGroq
import os
from dotenv import load_dotenv

load_dotenv()

client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))


async def get_set_feedback(session):
    """Called after each set completes"""
    prompt = f"""
You are a professional gym trainer giving feedback after a set.
Be concise, motivating and specific. Max 2-3 sentences.

Exercise: {session["exercise"]}
Set: {session["current_set"]} of {session["target_sets"]}
Target reps: {session["target_reps"]}
Completed reps: {len(session["current_set_depths"])}
Depth angles per rep: {[round(d,1) for d in session["current_set_depths"]]}
Target depth angle: below {session["target_depth"]}°
Rep durations (seconds): {[round(t,1) for t in session["current_set_rep_times"]]}

Look for depth consistency, pace changes, and whether they hit target reps.
Give specific actionable feedback like a real trainer would.
"""
    response = await client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150
    )
    return response.choices[0].message.content


async def get_session_summary(session):
    """Called after all sets complete — full performance analysis"""

    sets_summary = ""
    total_reps = 0
    for s in session["completed_sets"]:
        avg_depth = round(sum(s["depths"]) / len(s["depths"]), 1) if s["depths"] else 0
        avg_time = round(sum(s["rep_times"]) / len(s["rep_times"]), 1) if s["rep_times"] else 0
        sets_summary += f"""
  Set {s["set_number"]}: {s["reps_completed"]} reps | 
  Avg depth: {avg_depth}° | Avg rep time: {avg_time}s
  Depths: {[round(d,1) for d in s["depths"]]}"""
        total_reps += s["reps_completed"]

    prompt = f"""
You are a professional gym trainer giving a full session performance review.
Be honest, specific and motivating. Give 4-5 sentences max.

Exercise: {session["exercise"]}
Total sets: {len(session["completed_sets"])}/{session["target_sets"]}
Total reps: {total_reps}/{session["target_reps"] * session["target_sets"]}
Target depth: below {session["target_depth"]}°

Per set breakdown:
{sets_summary}

Analyze:
1. Overall performance score out of 10
2. Consistency across sets (did form get worse?)
3. One specific thing they did well
4. One specific thing to improve next session
5. Recommendation for next session (more reps, same, or less?)

Format your response naturally like a trainer talking to their client.
Start with the score like: "Performance Score: X/10"
"""
    response = await client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300
    )
    return response.choices[0].message.content