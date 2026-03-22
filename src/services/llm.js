'use strict';

const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');
const logger = require('../utils/logger');

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

function candidateContext() {
  return {
    name:   process.env.CANDIDATE_NAME             || 'Candidate',
    role:   process.env.CANDIDATE_TARGET_ROLE      || 'Software Engineer',
    skills: process.env.CANDIDATE_SKILLS           || '',
    years:  process.env.CANDIDATE_EXPERIENCE_YEARS || '5',
    loc:    process.env.CANDIDATE_LOCATION         || 'Remote',
  };
}

async function callOpenRouter(messages, maxTokens) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

  const response = await axios.post(
    `${OPENROUTER_BASE}/chat/completions`,
    {
      model:       process.env.LLM_MODEL || 'openai/gpt-4o-mini',
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.3'),
      max_tokens:  maxTokens,
      messages,
    },
    {
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title':      'Job Application Agent',
      },
      timeout: 30000,
    }
  );
  return response.data.choices?.[0]?.message?.content || '';
}

async function withRetry(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.response?.status === 429) {
      logger.warn('LLM rate limited — retrying in 10s');
      await new Promise(r => setTimeout(r, 10000));
      return fn();
    }
    throw err;
  }
}

/**
 * Score a job against the candidate profile.
 * Returns { fit_score, rationale, missing_skills }.
 */
async function scoreJob({ title, company, description, requirements }) {
  const c = candidateContext();

  const systemPrompt = [
    `You are a career coach evaluating job fit for ${c.name}.`,
    ``,
    `Candidate profile:`,
    `- Target role: ${c.role}`,
    `- Skills: ${c.skills}`,
    `- Years of experience: ${c.years}`,
    `- Location preference: ${c.loc}`,
    ``,
    `Scoring rubric (fit_score 0-100):`,
    `- 90-100: Role matches exactly, 80%+ required skills present, location/remote matches`,
    `- 70-89:  Role closely matches, 60-80% skills match, minor gaps`,
    `- 50-69:  Partial match, significant skill gaps or wrong seniority`,
    `- Below 50: Wrong role, major skill mismatch, or location incompatible`,
    ``,
    `Respond with valid JSON ONLY — no markdown fences, no extra text:`,
    `{"fit_score":<integer 0-100>,"rationale":"<2-3 sentences>","missing_skills":["skill1"]}`,
  ].join('\n');

  const userPrompt = `Job Title: ${title}\nCompany: ${company}\n\nDescription:\n${description || 'Not provided'}\n\nRequirements:\n${requirements || 'Not provided'}`;

  const raw = await withRetry(() => callOpenRouter([
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ], 512));

  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let result;
  try {
    result = JSON.parse(cleaned);
  } catch (parseErr) {
    logger.error(`LLM JSON parse failed for "${title}": ${parseErr.message} | raw: ${raw.slice(0, 200)}`);
    throw new Error('LLM response was not valid JSON');
  }

  if (typeof result.fit_score !== 'number') {
    throw new Error(`LLM returned invalid fit_score: ${JSON.stringify(result)}`);
  }

  logger.info(`Scored "${title}" @ ${company}: ${result.fit_score}/100`);
  return result;
}

/**
 * Generate a tailored cover letter and save it to artifacts/cover-letters/.
 * Returns { text, filePath }.
 */
async function generateCoverLetter({ jobId, title, company, description, requirements, rationale }) {
  const c = candidateContext();

  const systemPrompt = [
    `You are a professional cover letter writer helping ${c.name} apply for jobs.`,
    ``,
    `Candidate profile:`,
    `- Name: ${c.name}`,
    `- Target role: ${c.role}`,
    `- Skills: ${c.skills}`,
    `- Years of experience: ${c.years}`,
    `- Location: ${c.loc}`,
    ``,
    `Write a professional, concise cover letter in exactly 3 paragraphs:`,
    `1. Opening: enthusiastic connection between candidate and this specific role`,
    `2. Middle: 2-3 concrete skills or achievements that directly address job requirements`,
    `3. Closing: call to action, express genuine interest in an interview`,
    ``,
    `Tone: professional, direct, confident. No "I am writing to apply" opener.`,
    `Output ONLY the cover letter body — no subject line, no date, no address block.`,
  ].join('\n');

  const userPrompt = [
    `Job Title: ${title}`,
    `Company: ${company}`,
    ``,
    `Job Description:\n${description || 'Not provided'}`,
    ``,
    `Requirements:\n${requirements || 'Not provided'}`,
    ``,
    `Why this is a strong fit:\n${rationale || 'Strong skills alignment'}`,
  ].join('\n');

  const text = await withRetry(() => callOpenRouter([
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ], 1024));

  const dir = path.resolve('./artifacts/cover-letters');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${jobId}-${Date.now()}.txt`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, text, 'utf8');

  logger.info(`Cover letter saved: ${filePath}`);
  return { text, filePath };
}

module.exports = { scoreJob, generateCoverLetter };
