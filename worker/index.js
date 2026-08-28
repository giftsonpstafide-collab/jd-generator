/**
 * RecruitIntel - Cloudflare Worker Backend
 * Exposes a POST /generate-jd endpoint to securely communicate with the Gemini API.
 * Keeps the Gemini API key hidden from client-side chrome extensions.
 */

export default {
  async fetch(request, env) {
    // 1. CORS Headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400", // 24 hours
    };

    // 2. Handle CORS OPTIONS Preflight Request
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // 3. Handle POST Requests to /generate-jd
    const url = new URL(request.url);
    if (request.method === "POST" && (url.pathname === "/generate-jd" || url.pathname === "/generate-jd/")) {
      try {
        // Parse payload parameters
        const body = await request.json().catch(() => null);
        if (!body) {
          return new Response(JSON.stringify({ success: false, error: "Invalid JSON request payload." }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        const { role, location, contractDuration, jobFormatPrompt, originalJD } = body;

        // Validation checks
        if (!originalJD) {
          return new Response(JSON.stringify({ success: false, error: "Original Job Description (originalJD) is required." }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        if (!jobFormatPrompt) {
          return new Response(JSON.stringify({ success: false, error: "Job Format Prompt (jobFormatPrompt) guidelines are required." }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // Retrieve Gemini API Key from Worker Secret environment variables
        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
          console.error("Missing GEMINI_API_KEY secret environment variable.");
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Gemini API Key is not configured on the remote Cloudflare Worker secret environment. Please add GEMINI_API_KEY as a secret." 
          }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }

        // 4. Construct Gemini API call elements
        const systemInstruction = `You are an expert Job Description Transformation Engine.

Your task is to transform an original Job Description or set of job requirements into the output format specified by the Job Format Prompt.

The original JD is the ONLY source of truth for job-related information.

The Job Format Prompt controls how information should be organized and presented.

You may:
- Rewrite sentences professionally.
- Correct grammar.
- Remove unnecessary repetition.
- Combine related information.
- Organize information logically.
- Convert fragmented requirements into complete professional statements.
- Normalize terminology without changing meaning.

You must NOT:
- Invent technologies.
- Invent responsibilities.
- Invent years of experience.
- Invent certifications.
- Invent education requirements.
- Invent language requirements.
- Invent location.
- Invent contract duration.
- Invent salary.
- Invent benefits.
- Invent company culture.
- Invent remote or hybrid arrangements.
- Add technologies because they are common for the role.
- Infer requirements solely from the job title.
- Infer years of experience from seniority.
- Use double asterisks (**) or single asterisks (*) to bold words or phrases. All text must be in plain text format without bold highlights.
- Use dashes (-), asterisks (*), or other list bullet indicators at the start of lines. All list items must be clean, plain text lines.

If information is not present in the original JD, do not fabricate it.

Preserve mandatory versus optional requirements.

Preserve explicit experience ranges exactly.

Preserve explicit language requirements exactly.

Preserve explicit location and contract information.

Follow the Job Format Prompt exactly.

Return only the requested final output.`;

        // Format metadata headers context if provided
        let metadataHeader = "";
        if (role) metadataHeader += `Target Role: ${role}\n`;
        if (location) metadataHeader += `Target Location: ${location}\n`;
        if (contractDuration) metadataHeader += `Contract Duration: ${contractDuration}\n`;

        const userPrompt = `Job Format Prompt:
${jobFormatPrompt}

Metadata Info (Contextual details):
${metadataHeader || "No explicit metadata provided."}

Original Job Description:
"""
${originalJD}
"""

Instructions: Execute the job format mapping on the original job description. Do not generate code fences, explanation prefaces, or postscript messages. Output only the mapped result.`;

        // Assemble native Gemini REST JSON payload structure
        const geminiPayload = {
          contents: [
            {
              parts: [
                { text: userPrompt }
              ]
            }
          ],
          systemInstruction: {
            parts: [
              { text: systemInstruction }
            ]
          },
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 2548
          }
        };

        // Call Gemini Model (using gemini-2.5-flash for maximum latency performance)
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const geminiResponse = await fetch(geminiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(geminiPayload)
        });

        if (!geminiResponse.ok) {
          const geminiErr = await geminiResponse.json().catch(() => ({}));
          const errMsg = geminiErr?.error?.message || `Gemini response HTTP code ${geminiResponse.status}`;
          throw new Error(`Gemini Server Error: ${errMsg}`);
        }

        const geminiData = await geminiResponse.json();
        let outputText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!outputText) {
          throw new Error("Unable to parse text candidate from Gemini payload.");
        }

        // Clean out raw code fence wraps if returned by the LLM
        outputText = cleanResponse(outputText);

        // 5. Send Success Response
        return new Response(JSON.stringify({
          success: true,
          output: outputText
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });

      } catch (error) {
        console.error("Worker Execution Error:", error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message || "An unexpected error occurred during transformation."
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // 6. Handle Fallback Routings
    return new Response(JSON.stringify({ success: false, error: "Not Found. Make requests using POST /generate-jd" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

/**
 * Cleans markdown code block quotes from the response if the model appends them
 * and removes any asterisk (*) symbols used for bolding or formatting.
 */
function cleanResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```markdown")) {
    cleaned = cleaned.substring(11);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  
  // Remove any bullet indicators (dashes or asterisks) at the beginning of lines
  cleaned = cleaned.replace(/^\s*[\-\*]\s+/gm, "");

  // Remove single or double asterisks used for bold formatting
  cleaned = cleaned.replace(/\*/g, "");
  
  return cleaned.trim();
}
