/**
 * RecruitIntel - Settings Controller
 * Handles loading, saving, and resetting the Job Format Prompt.
 */

document.addEventListener('DOMContentLoaded', () => {
    // UI ELEMENTS
    const elements = {
        textareaPrompt: document.getElementById('textarea-prompt'),
        btnSave: document.getElementById('btn-save'),
        btnReset: document.getElementById('btn-reset'),
        toast: document.getElementById('toast'),
        toastIcon: document.getElementById('toast-icon'),
        toastMessage: document.getElementById('toast-message')
    };

    // INITIALIZATION
    function init() {
        loadSettings();
        
        elements.btnSave.addEventListener('click', saveSettings);
        elements.btnReset.addEventListener('click', resetToDefault);
    }

    // STORAGE READ
    function loadSettings() {
        chrome.storage.local.get(['jobFormatPrompt'], (result) => {
            if (result.jobFormatPrompt) {
                elements.textareaPrompt.value = result.jobFormatPrompt;
            } else {
                // Populate default
                const defaultPrompt = getDefaultJobFormatPrompt();
                elements.textareaPrompt.value = defaultPrompt;
                // Save it so it's initialized
                chrome.storage.local.set({ jobFormatPrompt: defaultPrompt });
            }
        });
    }

    // STORAGE WRITE
    function saveSettings() {
        const promptValue = elements.textareaPrompt.value.trim();
        
        if (!promptValue) {
            showToast("Job Format Prompt cannot be blank!", "error");
            return;
        }

        chrome.storage.local.set({ jobFormatPrompt: promptValue }, () => {
            showToast("Settings saved successfully!", "success");
        });
    }

    // RESET FUNCTION
    function resetToDefault() {
        if (confirm("Are you sure you want to reset the prompt to the company's default template? Any custom edits will be lost.")) {
            const defaultPrompt = getDefaultJobFormatPrompt();
            elements.textareaPrompt.value = defaultPrompt;
            
            chrome.storage.local.set({ jobFormatPrompt: defaultPrompt }, () => {
                showToast("Reset to default template successful.", "success");
            });
        }
    }

    // NOTIFICATION TOAST
    function showToast(message, type = 'success') {
        elements.toastMessage.textContent = message;
        elements.toast.className = 'toast'; // reset
        
        if (type === 'error') {
            elements.toastIcon.className = 'fa-solid fa-triangle-exclamation';
            elements.toast.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        } else {
            elements.toastIcon.className = 'fa-solid fa-circle-check';
            elements.toast.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        }
        
        elements.toast.classList.remove('hidden');
        
        if (window.toastTimeout) clearTimeout(window.toastTimeout);
        
        window.toastTimeout = setTimeout(() => {
            elements.toast.classList.add('hidden');
        }, 3000);
    }

    // COMPANYS CURRENT DEFAULT FORMAT
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

    init();
});
