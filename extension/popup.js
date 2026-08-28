/**
 * RecruitIntel - Extension Popup Controller
 * Communicates with the remote Cloudflare Worker to transform Job Descriptions.
 */

// ==================================================
// CONFIGURATION
// ==================================================
// The developer will replace this URL after deploying the Cloudflare Worker.
// In development, you can point this to your deployed worker URL.
const API_ENDPOINT = "https://internal-jd-generator.giftson-p-stafide.workers.dev/api/ai";

document.addEventListener('DOMContentLoaded', () => {
    // UI ELEMENTS
    const elements = {
        // Screens
        screenInput: document.getElementById('screen-input'),
        screenResult: document.getElementById('screen-result'),

        // Form Inputs
        form: document.getElementById('generator-form'),
        inputRole: document.getElementById('input-role'),
        inputLocation: document.getElementById('input-location'),
        inputContract: document.getElementById('input-contract'),
        inputRawJd: document.getElementById('input-raw-jd'),
        btnGenerate: document.getElementById('btn-generate'),

        // Output Results
        outputJdTextarea: document.getElementById('output-jd-textarea'),
        btnCopy: document.getElementById('btn-copy'),
        btnRegenerate: document.getElementById('btn-regenerate'),
        btnNewJd: document.getElementById('btn-new-jd'),

        // Config options button
        btnSettings: document.getElementById('btn-settings'),

        // Overlays & Alerts
        loadingOverlay: document.getElementById('loading-overlay'),
        progressFill: document.getElementById('progress-fill'),
        errorAlert: document.getElementById('error-alert'),
        errorMessage: document.getElementById('error-message'),
        btnCloseError: document.getElementById('btn-close-error'),
        toast: document.getElementById('toast'),
        toastMessage: document.getElementById('toast-message')
    };

    // CACHED FORM VALUES FOR REGENERATION
    let cachedInputs = null;

    // INITIALIZATION
    function init() {
        // Event Listeners
        elements.form.addEventListener('submit', handleFormSubmit);
        elements.btnSettings.addEventListener('click', openSettingsPage);
        elements.btnCopy.addEventListener('click', copyToClipboard);
        elements.btnRegenerate.addEventListener('click', handleRegenerate);
        elements.btnNewJd.addEventListener('click', handleNewJd);
        elements.btnCloseError.addEventListener('click', hideError);

        // Check if options page opens settings.html successfully
        checkDefaultFormatPrompt();
    }

    // ONBOARDING: Ensure there is at least an initial format prompt in storage
    function checkDefaultFormatPrompt() {
        chrome.storage.local.get(['jobFormatPrompt'], (result) => {
            const hasOldFormat = result.jobFormatPrompt && (
                result.jobFormatPrompt.includes("## 1.") || 
                result.jobFormatPrompt.includes("Use Markdown.") || 
                result.jobFormatPrompt.includes("Bold important technical") ||
                result.jobFormatPrompt.includes("Use dashes (-)")
            );
            
            if (!result.jobFormatPrompt || hasOldFormat) {
                // Pre-populate or migrate to the new clean default prompt
                const defaultPrompt = getDefaultJobFormatPrompt();
                chrome.storage.local.set({ jobFormatPrompt: defaultPrompt }, () => {
                    console.log("Updated/Migrated Job Format Prompt in storage to remove formatting symbols.");
                });
            }
        });
    }

    // ACTIONS
    function openSettingsPage() {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            chrome.tabs.create({ url: 'settings.html' });
        }
    }

    function switchScreen(screenName) {
        if (screenName === 'input') {
            elements.screenInput.classList.add('active');
            elements.screenResult.classList.remove('active');
        } else if (screenName === 'result') {
            elements.screenInput.classList.remove('active');
            elements.screenResult.classList.add('active');
        }
    }

    // GENERATION PROCESS
    function handleFormSubmit(e) {
        e.preventDefault();

        const role = elements.inputRole.value.trim();
        const location = elements.inputLocation.value.trim();
        const contract = elements.inputContract.value.trim();
        const originalJD = elements.inputRawJd.value.trim();

        // 1. Validate Original JD is empty
        if (!originalJD) {
            showError("Please enter the original JD or requirements.");
            elements.inputRawJd.focus();
            return;
        }

        // Cache inputs for possible regeneration
        cachedInputs = { role, location, contract, originalJD };

        // 2. Load the Job Format Prompt from storage
        chrome.storage.local.get(['jobFormatPrompt'], (result) => {
            const formatPrompt = result.jobFormatPrompt ? result.jobFormatPrompt.trim() : "";

            // Validate Job Format Prompt is configured
            if (!formatPrompt) {
                showError("Please configure the Job Format Prompt in Settings.");
                return;
            }

            // Start generation request
            generateJD(role, location, contract, originalJD, formatPrompt);
        });
    }

    function handleRegenerate() {
        if (!cachedInputs) return;

        chrome.storage.local.get(['jobFormatPrompt'], (result) => {
            const formatPrompt = result.jobFormatPrompt ? result.jobFormatPrompt.trim() : "";

            if (!formatPrompt) {
                showError("Please configure the Job Format Prompt in Settings.");
                return;
            }

            generateJD(
                cachedInputs.role,
                cachedInputs.location,
                cachedInputs.contract,
                cachedInputs.originalJD,
                formatPrompt
            );
        });
    }

    async function generateJD(role, location, contract, originalJD, formatPrompt) {
        // Show loading state
        hideError();
        elements.loadingOverlay.classList.remove('hidden');
        elements.btnGenerate.disabled = true;
        animateLoadingBar(true);

        const requestPayload = {
            role: role,
            location: location,
            contractDuration: contract,
            jobFormatPrompt: formatPrompt,
            originalJD: originalJD
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 40000); // 40-second timeout

        try {
            if (API_ENDPOINT.includes("YOUR-WORKER-URL")) {
                throw new Error("API Endpoint URL not configured. Click the gear icon to view settings, then configure your Cloudflare Worker URL in the extension files.");
            }

            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestPayload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            animateLoadingBar(false, 100); // instantly complete progress

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMessage = errData?.error || `HTTP error ${response.status}`;
                throw new Error(`Worker Error: ${errMessage}`);
            }

            const data = await response.json();

            if (data.success && data.output) {
                // Populate result screen with cleaned text formatting
                elements.outputJdTextarea.value = cleanOutputFormatting(data.output);
                switchScreen('result');
                showToast("Job description generated successfully!");
            } else {
                throw new Error(data.error || "Failed to retrieve generated description from backend.");
            }

        } catch (error) {
            console.error("Fetch failure:", error);

            let message = "Network error. Please verify your internet connection and Cloudflare Worker status.";
            if (error.name === 'AbortError') {
                message = "The request timed out. The AI model took too long to respond. Please try again.";
            } else if (error.message) {
                message = error.message;
            }

            showError(message);
        } finally {
            clearTimeout(timeoutId);
            elements.loadingOverlay.classList.add('hidden');
            elements.btnGenerate.disabled = false;
        }
    }

    function handleNewJd() {
        // Clear forms and caches
        elements.inputRole.value = "";
        elements.inputLocation.value = "";
        elements.inputContract.value = "";
        elements.inputRawJd.value = "";
        elements.outputJdTextarea.value = "";
        cachedInputs = null;

        switchScreen('input');
        hideError();
    }

    // TOASTS & ERRORS
    function showError(message) {
        elements.errorMessage.textContent = message;
        elements.errorAlert.classList.remove('hidden');
    }

    function hideError() {
        elements.errorAlert.classList.add('hidden');
    }

    function showToast(message) {
        elements.toastMessage.textContent = message;
        elements.toast.classList.remove('hidden');

        if (window.toastTimeout) clearTimeout(window.toastTimeout);

        window.toastTimeout = setTimeout(() => {
            elements.toast.classList.add('hidden');
        }, 3000);
    }

    function copyToClipboard() {
        const text = elements.outputJdTextarea.value;
        if (!text) return;

        navigator.clipboard.writeText(text)
            .then(() => {
                showToast("Copied to clipboard!");
            })
            .catch(err => {
                console.error("Clipboard copy failed:", err);
                showToast("Failed to copy text.");
            });
    }

    // LOADING BAR LOOPS
    let loadingInterval = null;
    function animateLoadingBar(start, finalPercent = 0) {
        if (loadingInterval) clearInterval(loadingInterval);

        if (!start) {
            elements.progressFill.style.width = `${finalPercent}%`;
            return;
        }

        let width = 0;
        elements.progressFill.style.width = '0%';

        // Incremental loading simulation (slows down as it approaches 95%)
        loadingInterval = setInterval(() => {
            if (width >= 90) {
                width += 0.2;
            } else if (width >= 60) {
                width += 1;
            } else {
                width += 3;
            }

            if (width >= 98) {
                clearInterval(loadingInterval);
            }
            elements.progressFill.style.width = `${width}%`;
        }, 150);
    }

    // Clean formatting markers from final output (e.g. stars, hashtags, dashes)
    function cleanOutputFormatting(text) {
        let cleaned = text;
        
        // Remove any bullet indicators (dashes or asterisks) at the beginning of lines
        cleaned = cleaned.replace(/^\s*[\-\*]\s+/gm, "");
        
        // Remove bolding or italics asterisks
        cleaned = cleaned.replace(/\*/g, "");
        
        // Remove markdown header hashtags (e.g. ## at start of line)
        cleaned = cleaned.replace(/^#+\s+/gm, "");
        
        return cleaned.trim();
    }

    // FALLBACK DEFAULT VALUE DEFINITION
    function getDefaultJobFormatPrompt() {
        return `Transform the original Job Description into the company's internal Job Description format.

The original Job Description is the ONLY source of truth.

The output must follow exactly these four sections:

1. As an [ROLE], you will:

Describe the key responsibilities of the candidate.

Include responsibilities explicitly supported by the source JD.

Rewrite fragmented responsibilities into professional sentences.

Do not invent responsibilities.

2. What You Bring to the Table:

Describe what the candidate needs to bring to the role.

Include, where explicitly available:

- Years of professional experience
- Technical skills
- Programming languages
- Cloud technologies
- Frameworks
- Architecture experience
- Domain experience
- Certifications
- Education requirements
- Language requirements
- Mandatory requirements
- Optional / nice-to-have requirements

Do not invent requirements.

3. You should possess the ability to:

Describe meaningful capabilities the candidate should possess.

Focus on what the candidate should be able to accomplish.

Do not simply repeat Section 2.

Do not introduce unsupported capabilities.

4. What we bring to the table:

Describe the opportunity based ONLY on information supported by the source JD.

Include, where available:

- Technology/project exposure
- Work environment explicitly mentioned
- Location
- Contract duration
- Engagement information
- Project information

Do not invent:

- Salary
- Benefits
- Vacation
- Remote work
- Hybrid work
- Company culture
- Career progression
- Bonuses
- Training
- Other benefits

Formatting rules:

- Do not use markdown headers (no # or ## symbols). Use plain text titles with numbers (e.g., "1. As an [ROLE], you will:").
- Do not use dashes (-), asterisks (*), or any other bullet symbols. Start each list item on a new line as plain text.
- Do NOT bold text. Do NOT use asterisks (**) or any other formatting to bold text.
- Avoid unnecessary repetition.
- Preserve the meaning of the original JD.
- Preserve explicit experience ranges.
- Preserve mandatory versus optional requirements.
- Preserve explicit language requirements.
- Preserve explicit location.
- Preserve explicit contract duration.
- Do not invent information.
- Return ONLY the final formatted JD.
- Do not include explanations before or after the JD.`;
    }

    // Start Controller
    init();
});
